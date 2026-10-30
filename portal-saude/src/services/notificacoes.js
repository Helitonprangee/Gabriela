import nodemailer from 'nodemailer';
import { all, one, run } from '../db.js';
import { config } from '../config.js';

// Canais externos substituíveis nos testes.
let transporteEmail;
let enviarHttp = (...args) => fetch(...args);
export function definirCanais({ email, http } = {}) {
  if (email !== undefined) transporteEmail = email;
  if (http !== undefined) enviarHttp = http;
}

export const canaisConfigurados = () => ({
  email: Boolean(config.email.smtpUrl || transporteEmail),
  whatsapp: Boolean(config.whatsapp.accountSid && config.whatsapp.authToken && config.whatsapp.remetente),
});

/** Converte telefone brasileiro para o formato internacional +55DDDNÚMERO. */
export function telefoneE164(tel) {
  let d = String(tel ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? `+${d}` : null;
}

async function enviarEmail(para, assunto, texto, link) {
  transporteEmail ??= nodemailer.createTransport(config.email.smtpUrl);
  const url = link ? `${config.urlPublica}/${link}` : config.urlPublica;
  await transporteEmail.sendMail({
    from: config.email.remetente,
    to: para,
    subject: assunto,
    text: `${texto}\n\nAcesse o portal: ${url}\n\nVocê recebe este aviso porque autorizou lembretes por e-mail no seu perfil do Viva Bem.`,
  });
}

async function enviarWhatsapp(telefone, texto, link) {
  const { accountSid, authToken, remetente } = config.whatsapp;
  const corpo = new URLSearchParams({
    From: remetente.startsWith('whatsapp:') ? remetente : `whatsapp:${remetente}`,
    To: `whatsapp:${telefone}`,
    Body: `${texto}\n${link ? `${config.urlPublica}/${link}` : config.urlPublica}`,
  });
  const r = await enviarHttp(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: corpo,
  });
  if (!r.ok) throw new Error(`Twilio respondeu ${r.status}`);
}

/**
 * Cria um aviso dentro do portal e, se pedido, envia também por e-mail/WhatsApp,
 * respeitando a autorização que o colaborador deu no perfil.
 * O par (tipo, referencia_id) evita avisos repetidos.
 */
export async function notificar(usuarioId, { tipo, referenciaId = null, titulo, mensagem, link = null }, { externo = false } = {}) {
  const { changes, lastInsertRowid } = run(
    `INSERT OR IGNORE INTO notificacoes (usuario_id, tipo, referencia_id, titulo, mensagem, link) VALUES (?, ?, ?, ?, ?, ?)`,
    usuarioId, tipo, referenciaId, titulo, mensagem, link,
  );
  if (!changes || !externo) return { criada: Boolean(changes), canais: [] };

  const u = one('SELECT email, telefone, aceita_email, aceita_whatsapp FROM usuarios WHERE id = ? AND ativo = 1', usuarioId);
  const canais = [];
  const disponiveis = canaisConfigurados();
  if (u?.aceita_email && u.email && disponiveis.email) {
    try { await enviarEmail(u.email, `Viva Bem: ${titulo}`, mensagem, link); canais.push('email'); }
    catch (err) { console.error('Falha no e-mail para usuário', usuarioId, err.message); }
  }
  const tel = telefoneE164(u?.telefone);
  if (u?.aceita_whatsapp && tel && disponiveis.whatsapp) {
    try { await enviarWhatsapp(tel, `*${titulo}*\n${mensagem}`, link); canais.push('whatsapp'); }
    catch (err) { console.error('Falha no WhatsApp para usuário', usuarioId, err.message); }
  }
  if (canais.length) run('UPDATE notificacoes SET canais = ? WHERE id = ?', canais.join(','), lastInsertRowid);
  return { criada: true, canais };
}

export function listarNotificacoes(usuarioId) {
  return {
    nao_lidas: one('SELECT COUNT(*) AS n FROM notificacoes WHERE usuario_id = ? AND lida = 0', usuarioId).n,
    itens: all('SELECT id, tipo, titulo, mensagem, link, lida, created_at FROM notificacoes WHERE usuario_id = ? ORDER BY id DESC LIMIT 30', usuarioId),
  };
}

export const marcarLidas = (usuarioId) => run('UPDATE notificacoes SET lida = 1 WHERE usuario_id = ? AND lida = 0', usuarioId);

const somarDias = (data, dias) => {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

/**
 * Verifica prazos e manda os lembretes. Roda periodicamente; pode rodar quantas vezes
 * quiser, porque cada lembrete só é criado uma vez por desafio.
 */
export async function executarLembretes(hoje = new Date()) {
  const dia = hoje.toISOString().slice(0, 10);
  const alvo = somarDias(dia, config.lembreteDiasAntes);
  const desafios = all(
    `SELECT d.id, d.usuario_id, d.titulo, d.prazo, d.pontos FROM desafios d JOIN usuarios u ON u.id = d.usuario_id
     WHERE d.status = 'ativo' AND u.ativo = 1 AND d.prazo IN (?, ?)`,
    dia, alvo,
  );
  let enviados = 0;
  for (const d of desafios) {
    const ultimoDia = d.prazo === dia;
    const r = await notificar(d.usuario_id, {
      tipo: ultimoDia ? 'prazo_hoje' : 'prazo_proximo',
      referenciaId: d.id,
      titulo: ultimoDia ? 'Último dia do seu desafio!' : `Faltam ${config.lembreteDiasAntes} dias para o prazo`,
      mensagem: `"${d.titulo}" vale ${d.pontos} pontos e ${ultimoDia ? 'termina hoje' : `termina em ${d.prazo.split('-').reverse().join('/')}`}. Faça a atividade e envie o comprovante pelo portal.`,
      link: `#/desafio/${d.id}`,
    }, { externo: true });
    if (r.criada) enviados++;
  }
  return enviados;
}
