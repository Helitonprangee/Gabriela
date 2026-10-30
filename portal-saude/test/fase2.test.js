import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db, one, run } from '../src/db.js';
import { config } from '../src/config.js';
import { hashSenha } from '../src/auth.js';
import { definirCanais, executarLembretes, notificar, telefoneE164 } from '../src/services/notificacoes.js';
import { concluirPausa, montarPausa } from '../src/services/pausa.js';
import { periodoDoMes } from '../src/services/ranking.js';
import { fazerBackup } from '../src/services/backup.js';
import { MOVIMENTOS } from '../public/exercicios.js';

const novoUsuario = (dados = {}) => Number(run(
  `INSERT INTO usuarios (matricula, nome, senha_hash, email, telefone, aceita_email, aceita_whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  dados.matricula ?? String(Math.random()).slice(2, 10), dados.nome ?? 'Teste Silva', hashSenha('x1234567'),
  dados.email ?? null, dados.telefone ?? null, dados.aceita_email ?? 0, dados.aceita_whatsapp ?? 0,
).lastInsertRowid);

test('migrações aplicadas: lojas, notificações, pausas e nova origem de pontos', () => {
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
  const sql = one(`SELECT sql FROM sqlite_master WHERE name = 'pontos_lancamentos'`).sql;
  assert.match(sql, /pausa_ativa/);
});

test('telefone brasileiro vira formato internacional', () => {
  assert.equal(telefoneE164('(41) 99876-5432'), '+5541998765432');
  assert.equal(telefoneE164('041 3333-4444'), '+554133334444');
  assert.equal(telefoneE164('+55 41 99876-5432'), '+5541998765432');
  assert.equal(telefoneE164('1234'), null);
});

test('lembretes de prazo: e-mail e WhatsApp só para quem autorizou, sem repetir', async () => {
  const emails = [];
  const zap = [];
  definirCanais({
    email: { sendMail: async (m) => { emails.push(m); } },
    http: async (url, opts) => { zap.push({ url, corpo: Object.fromEntries(opts.body) }); return { ok: true, status: 201 }; },
  });
  Object.assign(config.whatsapp, { accountSid: 'AC123', authToken: 'tok', remetente: 'whatsapp:+14155238886' });

  const autorizou = novoUsuario({ email: 'ana@empresa.com', telefone: '41 99876-5432', aceita_email: 1, aceita_whatsapp: 1 });
  const naoAutorizou = novoUsuario({ email: 'bia@empresa.com', telefone: '41 99876-0000' });
  const hoje = new Date('2026-11-10T12:00:00Z');
  const desafio = (u, prazo) => run(
    `INSERT INTO desafios (usuario_id, modelo_codigo, categoria, titulo, descricao, motivo, como_comprovar, criterios, pontos, prazo)
     VALUES (?, 'caminhada_30', 'atividade_fisica', 'Caminhada de 30 minutos', 'd', 'm', 'c', '{}', 5, ?)`, u, prazo);
  desafio(autorizou, '2026-11-12');
  desafio(naoAutorizou, '2026-11-10');
  desafio(naoAutorizou, '2026-11-20'); // longe do prazo: sem aviso

  assert.equal(await executarLembretes(hoje), 2);
  assert.equal(await executarLembretes(hoje), 0, 'não repete');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'ana@empresa.com');
  assert.match(emails[0].subject, /Faltam 2 dias/);
  assert.equal(zap.length, 1);
  assert.equal(zap[0].corpo.To, 'whatsapp:+5541998765432');
  assert.match(zap[0].url, /Accounts\/AC123\/Messages\.json$/);
  assert.ok(one(`SELECT 1 FROM notificacoes WHERE usuario_id = ? AND tipo = 'prazo_hoje'`, naoAutorizou), 'aviso no portal para todos');

  // falha no canal externo não impede o aviso no portal
  definirCanais({ http: async () => ({ ok: false, status: 500 }) });
  const r = await notificar(autorizou, { tipo: 'teste', referenciaId: 1, titulo: 'T', mensagem: 'M' }, { externo: true });
  assert.deepEqual(r, { criada: true, canais: ['email'] });
  Object.assign(config.whatsapp, { accountSid: '', authToken: '', remetente: '' });
});

test('pausa ativa: escolhe alongamentos pelo risco e respeita 5 minutos', () => {
  const perfil = (riscos, regioes = []) => ({ riscos: { movimentos_repetitivos: 0, horas_em_pe: 0, horas_sentado: 0, carrega_peso: 0, atendimento_publico: 0, ...riscos }, regioes: new Set(regioes) });
  const caixa = montarPausa(perfil({ movimentos_repetitivos: 3, atendimento_publico: 3 }, ['punhos', 'ombros']));
  const repositor = montarPausa(perfil({ carrega_peso: 3, horas_em_pe: 8 }, ['coluna', 'pernas']));
  const mov = (p) => p.passos.map((x) => x.mov);
  assert.ok(mov(caixa).includes('extensao_punho') && mov(caixa).includes('flexao_pescoco'));
  assert.ok(mov(repositor).includes('extensao_lombar') && mov(repositor).includes('panturrilha'));
  assert.ok(!mov(repositor).includes('extensao_punho'));
  for (const p of [caixa, repositor, montarPausa(perfil({}))]) {
    assert.ok(p.duracao <= 300 && p.duracao >= 120);
    assert.equal(p.passos.reduce((s, x) => s + x.tempo, 0), p.duracao);
    for (const x of p.passos) assert.ok(MOVIMENTOS[x.mov], x.mov);
  }
});

test('pausa ativa pontua só quando concluída e uma vez por dia', () => {
  const u = novoUsuario();
  const pausa = (seg) => Number(run(`INSERT INTO pausas_ativas (usuario_id, duracao_seg, iniciada_em) VALUES (?, 100, datetime('now', ?))`, u, `-${seg} seconds`).lastInsertRowid);
  assert.match(concluirPausa(u, pausa(30)).erro, /até o fim/);
  assert.deepEqual(concluirPausa(u, pausa(100)), { pontos: 1 });
  assert.deepEqual(concluirPausa(u, pausa(100)), { pontos: 0 }, 'segunda pausa do dia não pontua');
  const id = pausa(100);
  concluirPausa(u, id);
  assert.match(concluirPausa(u, id).erro, /já foi registrada/);
});

test('período do ranking', () => {
  assert.deepEqual(periodoDoMes('2026-12'), { mes: '2026-12', inicio: '2026-12-01', fim: '2027-01-01' });
  assert.equal(periodoDoMes('lixo').inicio.length, 10);
});

test('backup: copia banco e comprovantes e apaga os antigos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-'));
  fs.mkdirSync(config.uploadDir, { recursive: true });
  fs.writeFileSync(path.join(config.uploadDir, 'abc.png'), 'x');
  fs.writeFileSync(path.join(dir, 'portal-2026-01-01.db'), 'velho');
  const r = fazerBackup({ dir, hoje: new Date('2026-11-10T03:00:00Z'), diasRetencao: 14 });
  assert.ok(r.novo);
  assert.ok(fs.statSync(r.arquivo).size > 0);
  assert.ok(fs.existsSync(path.join(dir, 'uploads', 'abc.png')));
  assert.ok(!fs.existsSync(path.join(dir, 'portal-2026-01-01.db')));
  assert.equal(fazerBackup({ dir, hoje: new Date('2026-11-10T05:00:00Z') }).novo, false);
});
