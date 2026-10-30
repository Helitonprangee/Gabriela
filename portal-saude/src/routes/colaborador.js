import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { all, one, run } from '../db.js';
import { config } from '../config.js';
import { ATIVIDADES, RESTRICOES, calcularIdade, gerarDesafios } from '../services/desafios.js';
import { extrato, saldo } from '../services/pontos.js';
import { TIPOS_ACEITOS, validarComprovante } from '../services/validacao.js';
import { videoDoModelo } from '../services/videos.js';
import { listarNotificacoes, marcarLidas, telefoneE164 } from '../services/notificacoes.js';
import { concluirPausa, iniciarPausa, pausaDoColaborador } from '../services/pausa.js';
import { ranking } from '../services/ranking.js';
import { ErroResgate, catalogo, resgatar, resgatesDoUsuario } from '../services/recompensas.js';

export const rotasColaborador = Router();

fs.mkdirSync(config.uploadDir, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, Boolean(TIPOS_ACEITOS[file.mimetype])),
});

// Confere a assinatura real do arquivo, sem confiar só no tipo informado pelo navegador.
function tipoReal(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 3).toString() === 'GIF') return 'image/gif';
  if (buf.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  return null;
}

const CAMPOS_PERFIL = ['email', 'telefone', 'altura_cm', 'peso_kg', 'nivel_atividade', 'atividades_preferidas', 'restricoes', 'observacoes_saude', 'aceita_email', 'aceita_whatsapp'];

function perfilDe(usuarioId) {
  const u = one(
    `SELECT u.*, s.nome AS setor, c.nome AS cargo, l.nome AS loja FROM usuarios u
     LEFT JOIN setores s ON s.id = u.setor_id LEFT JOIN cargos c ON c.id = u.cargo_id LEFT JOIN lojas l ON l.id = u.loja_id WHERE u.id = ?`,
    usuarioId,
  );
  const { senha_hash: _, ...resto } = u;
  return { ...resto, idade: calcularIdade(u.data_nascimento) };
}

rotasColaborador.get('/perfil', (req, res) => {
  res.json({ perfil: perfilDe(req.usuario.id), opcoes: { atividades: ATIVIDADES, restricoes: RESTRICOES } });
});

rotasColaborador.put('/perfil', (req, res) => {
  const dados = req.body ?? {};
  const valores = {};
  for (const campo of CAMPOS_PERFIL) if (campo in dados) valores[campo] = dados[campo] === '' ? null : dados[campo];

  if (valores.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valores.email)) return res.status(400).json({ erro: 'E-mail inválido.' });
  for (const [campo, [min, max]] of Object.entries({ altura_cm: [100, 230], peso_kg: [30, 300] })) {
    if (valores[campo] != null) {
      const n = Number(valores[campo]);
      if (!Number.isFinite(n) || n < min || n > max) return res.status(400).json({ erro: `Valor inválido para ${campo.replace('_', ' ')}.` });
      valores[campo] = n;
    }
  }
  if (valores.nivel_atividade && !['sedentario', 'leve', 'moderado', 'intenso'].includes(valores.nivel_atividade)) {
    return res.status(400).json({ erro: 'Nível de atividade inválido.' });
  }
  for (const [campo, permitidos] of [['atividades_preferidas', ATIVIDADES], ['restricoes', RESTRICOES]]) {
    if (campo in valores) {
      const itens = Array.isArray(valores[campo]) ? valores[campo] : String(valores[campo] ?? '').split(',');
      valores[campo] = itens.map((s) => String(s).trim()).filter((s) => permitidos.includes(s)).join(',');
    }
  }
  for (const campo of ['aceita_email', 'aceita_whatsapp']) if (campo in valores) valores[campo] = valores[campo] === true || valores[campo] === 'true' ? 1 : 0;
  const atual = one('SELECT email, telefone FROM usuarios WHERE id = ?', req.usuario.id);
  if (valores.aceita_email && !(valores.email ?? atual.email)) return res.status(400).json({ erro: 'Informe o e-mail para receber lembretes por e-mail.' });
  if (valores.aceita_whatsapp && !telefoneE164(valores.telefone ?? atual.telefone)) {
    return res.status(400).json({ erro: 'Informe um celular com DDD para receber lembretes por WhatsApp.' });
  }
  const campos = Object.keys(valores);
  if (campos.length) {
    run(`UPDATE usuarios SET ${campos.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      ...campos.map((c) => valores[c]), req.usuario.id);
  }
  res.json({ perfil: perfilDe(req.usuario.id) });
});

function comprovantesDe(desafioIds) {
  if (!desafioIds.length) return {};
  const lista = all(
    `SELECT id, desafio_id, nome_original, status, motivo, suspeita_ia, created_at, validado_em FROM comprovantes
     WHERE desafio_id IN (${desafioIds.map(() => '?').join(',')}) ORDER BY id DESC`,
    ...desafioIds,
  );
  return Object.groupBy(lista, (c) => c.desafio_id);
}

const semCriterios = ({ criterios: _, ...d }) => d;

rotasColaborador.get('/painel', (req, res) => {
  gerarDesafios(req.usuario.id);
  const ativos = all(
    `SELECT * FROM desafios WHERE usuario_id = ? AND status IN ('ativo','em_analise') ORDER BY prazo`,
    req.usuario.id,
  );
  const porDesafio = comprovantesDe(ativos.map((d) => d.id));
  const resumo = one(
    `SELECT COUNT(*) FILTER (WHERE status = 'concluido') AS concluidos,
            COUNT(*) FILTER (WHERE status = 'expirado') AS expirados
     FROM desafios WHERE usuario_id = ?`,
    req.usuario.id,
  );
  res.json({
    nome: req.usuario.nome,
    saldo: saldo(req.usuario.id),
    ...resumo,
    desafios: ativos.map((d) => ({ ...semCriterios(d), comprovantes: porDesafio[d.id] ?? [] })),
  });
});

rotasColaborador.get('/desafios/:id', (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next();
  const d = one('SELECT * FROM desafios WHERE id = ? AND usuario_id = ?', Number(req.params.id), req.usuario.id);
  if (!d) return res.status(404).json({ erro: 'Desafio não encontrado.' });
  res.json({ ...semCriterios(d), comprovantes: comprovantesDe([d.id])[d.id] ?? [], video: videoDoModelo(d.modelo_codigo) });
});

rotasColaborador.get('/desafios/concluidos', (req, res) => {
  const lista = all(`SELECT * FROM desafios WHERE usuario_id = ? AND status = 'concluido' ORDER BY concluido_em DESC`, req.usuario.id);
  res.json(lista.map(semCriterios));
});

rotasColaborador.get('/pontos', (req, res) => {
  res.json({ saldo: saldo(req.usuario.id), lancamentos: extrato(req.usuario.id) });
});

rotasColaborador.post('/desafios/:id/comprovantes', upload.single('arquivo'), (req, res) => {
  const desafio = one('SELECT * FROM desafios WHERE id = ? AND usuario_id = ?', Number(req.params.id), req.usuario.id);
  if (!desafio) return res.status(404).json({ erro: 'Desafio não encontrado.' });
  if (desafio.status === 'concluido') return res.status(400).json({ erro: 'Este desafio já foi concluído.' });
  if (desafio.status === 'em_analise') return res.status(400).json({ erro: 'Já existe um comprovante em análise para este desafio.' });
  if (desafio.status === 'expirado' || desafio.prazo < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ erro: 'O prazo deste desafio terminou.' });
  }
  if (!req.file) return res.status(400).json({ erro: 'Anexe um arquivo JPG, PNG, WEBP, GIF ou PDF.' });
  const mime = tipoReal(req.file.buffer);
  if (!mime || !TIPOS_ACEITOS[mime]) return res.status(400).json({ erro: 'O arquivo não é uma imagem ou PDF válido.' });

  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' }[mime];
  const arquivo = path.join(config.uploadDir, `${crypto.randomUUID()}${ext}`);
  fs.writeFileSync(arquivo, req.file.buffer);

  const { lastInsertRowid } = run(
    `INSERT INTO comprovantes (desafio_id, usuario_id, arquivo, nome_original, mime, sha256) VALUES (?, ?, ?, ?, ?, ?)`,
    desafio.id, req.usuario.id, arquivo, req.file.originalname.slice(0, 200), mime, sha256,
  );
  run(`UPDATE desafios SET status = 'em_analise' WHERE id = ?`, desafio.id);
  const id = Number(lastInsertRowid);
  // A validação roda em segundo plano; o app consulta o resultado.
  setImmediate(() => validarComprovante(id).catch((err) => console.error('Erro na validação', id, err)));
  res.status(201).json({ id, status: 'em_analise' });
});

rotasColaborador.get('/comprovantes/:id/arquivo', (req, res) => {
  const c = one('SELECT * FROM comprovantes WHERE id = ? AND usuario_id = ?', Number(req.params.id), req.usuario.id);
  if (!c) return res.status(404).end();
  res.type(c.mime).sendFile(c.arquivo);
});

// ---------------- Recompensas ----------------

function exigirRecompensas(_req, res, next) {
  if (!config.recompensasHabilitadas) return res.status(404).json({ erro: 'Recompensas indisponíveis.' });
  next();
}

rotasColaborador.get('/recompensas', exigirRecompensas, (req, res) => {
  res.json({ saldo: saldo(req.usuario.id), itens: catalogo(), resgates: resgatesDoUsuario(req.usuario.id) });
});

rotasColaborador.post('/recompensas/:id/resgatar', exigirRecompensas, (req, res) => {
  try {
    const r = resgatar(req.usuario.id, Number(req.params.id));
    res.status(201).json({ ...r, saldo: saldo(req.usuario.id) });
  } catch (err) {
    if (err instanceof ErroResgate) return res.status(400).json({ erro: err.message });
    throw err;
  }
});

// ---------------- Avisos ----------------

rotasColaborador.get('/notificacoes', (req, res) => res.json(listarNotificacoes(req.usuario.id)));
rotasColaborador.post('/notificacoes/lidas', (req, res) => { marcarLidas(req.usuario.id); res.json({ ok: true }); });

// ---------------- Pausa ativa ----------------

rotasColaborador.get('/pausa-ativa', (req, res) => res.json(pausaDoColaborador(req.usuario.id)));
rotasColaborador.post('/pausa-ativa/iniciar', (req, res) => res.status(201).json({ id: iniciarPausa(req.usuario.id) }));
rotasColaborador.post('/pausa-ativa/:id/concluir', (req, res) => {
  const r = concluirPausa(req.usuario.id, Number(req.params.id));
  if (r.erro) return res.status(400).json(r);
  res.json({ ...r, saldo: saldo(req.usuario.id) });
});

// ---------------- Ranking ----------------

rotasColaborador.get('/ranking', (req, res) => {
  const r = ranking(req.query.mes);
  res.json({ ...r, minha_loja: req.usuario.loja_id, meu_setor: req.usuario.setor_id });
});
