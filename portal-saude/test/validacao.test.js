import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidir, inspecionarMetadados } from '../src/services/validacao.js';

const criterios = {
  tipo: 'atividade', atividades_aceitas: ['corrida'], duracao_minima_min: 30,
  nome_colaborador: 'Lucas Lima', data_inicio: '2026-10-20', data_fim: '2026-10-27',
};
const bom = {
  legivel: true, tipo_documento: 'print do Strava', nome_encontrado: 'Lucas Lima', nome_confere: true,
  data_encontrada: '2026-10-22', atividade_ou_exame_encontrado: 'Corrida', tipo_confere: true,
  duracao_min_encontrada: 32, indicios_manipulacao: [], suspeita_ia_ou_edicao: false, decisao: 'aprovado', motivo: 'Tudo certo.',
};
const hoje = new Date('2026-10-30');

test('aprova quando tudo confere', () => {
  assert.equal(decidir(bom, criterios, hoje).status, 'aprovado');
});

test('o sistema confere período e duração mesmo se a IA aprovar', () => {
  const fora = decidir({ ...bom, data_encontrada: '2026-10-28' }, criterios, hoje);
  assert.equal(fora.status, 'recusado');
  assert.match(fora.motivo, /28\/10\/2026 está fora do período/);
  const curta = decidir({ ...bom, duracao_min_encontrada: 25 }, criterios, hoje);
  assert.equal(curta.status, 'recusado');
  assert.match(curta.motivo, /25 min/);
});

test('recusa nome divergente e suspeita de IA, com motivo', () => {
  const r = decidir({ ...bom, nome_confere: false, suspeita_ia_ou_edicao: true, decisao: 'recusado', motivo: 'Envie o print original.' }, criterios, hoje);
  assert.equal(r.status, 'recusado');
  assert.ok(r.suspeitaIa);
  assert.match(r.motivo, /nome no comprovante não confere/);
  assert.match(r.motivo, /geração por IA/);
});

test('encontra marcas de IA e de editores nos metadados', () => {
  const buf = Buffer.from('....<x:xmpmeta>DigitalSourceType trainedAlgorithmicMedia Adobe Photoshop</x:xmpmeta>');
  const m = inspecionarMetadados(buf);
  assert.deepEqual(m.marcasIa, ['trainedAlgorithmicMedia']);
  assert.deepEqual(m.marcasEdicao, ['Photoshop']);
});
