import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { one, run } from '../src/db.js';
import { config } from '../src/config.js';
import { definirClienteIA, validarComprovante } from '../src/services/validacao.js';
import { saldo } from '../src/services/pontos.js';

fs.mkdirSync(config.uploadDir, { recursive: true });
const usuario = Number(run(`INSERT INTO usuarios (matricula, nome, senha_hash) VALUES ('1', 'Lucas Lima', 'x:y')`).lastInsertRowid);
const hoje = new Date().toISOString().slice(0, 10);
const criterios = { tipo: 'atividade', atividades_aceitas: ['corrida'], duracao_minima_min: 30, nome_colaborador: 'Lucas Lima', data_inicio: hoje, data_fim: '2999-01-01' };

function novoComprovante(conteudo) {
  const desafio = Number(run(
    `INSERT INTO desafios (usuario_id, modelo_codigo, categoria, titulo, descricao, motivo, como_comprovar, criterios, pontos, prazo, status)
     VALUES (?, 'corrida_30', 'atividade_fisica', 'Corrida de 30 minutos', 'd', 'm', 'c', ?, 8, '2999-01-01', 'em_analise')`,
    usuario, JSON.stringify(criterios)).lastInsertRowid);
  const arquivo = path.join(config.uploadDir, `${desafio}.png`);
  fs.writeFileSync(arquivo, conteudo);
  const id = Number(run(`INSERT INTO comprovantes (desafio_id, usuario_id, arquivo, nome_original, mime, sha256) VALUES (?, ?, ?, 'p.png', 'image/png', ?)`,
    desafio, usuario, arquivo, `sha-${desafio}`).lastInsertRowid);
  return { id, desafio };
}

test('envia a imagem e os critérios ao Claude e aprova automaticamente', async () => {
  let pedido;
  definirClienteIA({ beta: { messages: { create: async (p) => { pedido = p; return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({
      legivel: true, tipo_documento: 'print do Strava', nome_encontrado: 'Lucas Lima', nome_confere: true, data_encontrada: hoje,
      atividade_ou_exame_encontrado: 'Corrida', tipo_confere: true, duracao_min_encontrada: 31, indicios_manipulacao: [],
      suspeita_ia_ou_edicao: false, decisao: 'aprovado', motivo: 'Corrida de 31 min confere.' }) }],
  }; } } } });
  const { id, desafio } = novoComprovante(Buffer.from('imagem-1'));
  await validarComprovante(id);

  assert.equal(pedido.model, 'claude-opus-5-5');
  assert.equal(pedido.output_config.format.type, 'json_schema');
  assert.equal(pedido.fallbacks, 'default');
  assert.equal(pedido.messages[0].content[0].type, 'image');
  assert.match(pedido.messages[0].content[1].text, /Lucas Lima/);
  assert.equal(one('SELECT status FROM comprovantes WHERE id = ?', id).status, 'aprovado');
  assert.equal(one('SELECT status FROM desafios WHERE id = ?', desafio).status, 'concluido');
  assert.equal(saldo(usuario), 8);
});

test('recusa por metadados de IA sem chamar a API, e falhas da API ficam para o RH', async () => {
  let chamadas = 0;
  definirClienteIA({ beta: { messages: { create: async () => { chamadas++; throw new Error('rede fora'); } } } });
  const ia = novoComprovante(Buffer.from('xmp: trainedAlgorithmicMedia'));
  await validarComprovante(ia.id);
  assert.equal(chamadas, 0);
  const r = one('SELECT status, suspeita_ia FROM comprovantes WHERE id = ?', ia.id);
  assert.deepEqual([r.status, r.suspeita_ia], ['recusado', 1]);
  assert.equal(one('SELECT status FROM desafios WHERE id = ?', ia.desafio).status, 'ativo', 'pode reenviar');

  const falha = novoComprovante(Buffer.from('imagem-2'));
  await validarComprovante(falha.id);
  assert.equal(chamadas, 1);
  assert.equal(one('SELECT status FROM comprovantes WHERE id = ?', falha.id).status, 'em_analise');
});
