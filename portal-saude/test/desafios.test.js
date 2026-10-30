import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularIdade, inferirRiscosDoTexto, instanciarDesafio, montarPerfil, selecionarModelos } from '../src/services/desafios.js';
import { MODELOS } from '../src/services/catalogo.js';

const HOJE = new Date('2026-10-30T12:00:00');
const fixo = () => 0; // remove o sorteio para os testes serem determinísticos

const caixa = {
  cargo: { nome: 'Operador(a) de Caixa', descricao: 'Registra as compras no caixa e atende clientes.' },
  riscos: { movimentos_repetitivos: 3, horas_em_pe: 4, horas_sentado: 4, atendimento_publico: 3, regioes_sobrecarga: 'punhos,ombros' },
  funcoes: [{ nome: 'Registrar produtos', descricao: 'Passa os produtos no scanner.' }],
};
const perfilDe = (usuario, base = caixa) => montarPerfil({ usuario: { restricoes: '', atividades_preferidas: '', ...usuario }, ...base }, HOJE);
const codigos = (perfil, categoria, quantidade = 3) =>
  selecionarModelos(perfil, { categoria, quantidade, hoje: HOJE, aleatorio: fixo }).map((m) => m.codigo);

test('calcula a idade considerando o aniversário', () => {
  assert.equal(calcularIdade('1976-10-30', HOJE), 50);
  assert.equal(calcularIdade('1976-10-31', HOJE), 49);
  assert.equal(calcularIdade(null, HOJE), null);
});

test('mesmo setor, desafios diferentes: 50 anos recebe yoga/pilates; 20 anos recebe corrida', () => {
  const p50 = perfilDe({ data_nascimento: '1976-05-10', sexo: 'F' });
  const p20 = perfilDe({ data_nascimento: '2006-05-10', sexo: 'M' });
  const fisicos50 = codigos(p50, 'atividade_fisica');
  const fisicos20 = codigos(p20, 'atividade_fisica');
  assert.ok(fisicos50.some((c) => ['yoga_30', 'pilates_40'].includes(c)), fisicos50.join());
  assert.ok(!fisicos50.includes('corrida_30'));
  assert.ok(fisicos20.includes('corrida_30'), fisicos20.join());
  // ambos têm o risco de movimentos repetitivos do caixa
  assert.ok(fisicos50.includes('alongamento_membros_superiores_15'));
  assert.ok(fisicos20.includes('alongamento_membros_superiores_15'));
});

test('exames preventivos respeitam idade e sexo', () => {
  const mulher50 = codigos(perfilDe({ data_nascimento: '1975-01-01', sexo: 'F' }), 'saude_preventiva', 20);
  const homem50 = codigos(perfilDe({ data_nascimento: '1975-01-01', sexo: 'M' }), 'saude_preventiva', 20);
  const mulher22 = codigos(perfilDe({ data_nascimento: '2004-01-01', sexo: 'F' }), 'saude_preventiva', 20);
  assert.equal(mulher50[0], 'mamografia');
  assert.ok(mulher50.includes('papanicolau'));
  assert.ok(!homem50.includes('mamografia') && homem50.includes('saude_prostata'));
  assert.ok(!mulher22.includes('mamografia') && !mulher22.includes('papanicolau'));
});

test('restrições do perfil excluem atividades inadequadas', () => {
  const p = perfilDe({ data_nascimento: '2000-01-01', sexo: 'M', restricoes: 'impacto_articular,cardiaca' });
  const fisicos = codigos(p, 'atividade_fisica', 20);
  for (const c of ['corrida_30', 'funcional_30', 'bicicleta_45', 'danca_30']) assert.ok(!fisicos.includes(c), c);
  assert.ok(fisicos.includes('caminhada_30'));
});

test('a descrição do cargo influencia os riscos (mudar a descrição muda os desafios)', () => {
  const semRiscos = { cargo: { nome: 'Auxiliar', descricao: 'Apoio geral.' }, riscos: {}, funcoes: [] };
  const comCamara = { cargo: { nome: 'Auxiliar', descricao: 'Organiza caixas pesadas na câmara fria.' }, riscos: {}, funcoes: [] };
  const usuario = { data_nascimento: '1990-01-01', sexo: 'M' };
  assert.ok(!codigos(perfilDe(usuario, semRiscos), 'atividade_fisica', 20).includes('fortalecimento_lombar_20'));
  const p = perfilDe(usuario, comCamara);
  assert.equal(p.riscos.ambiente_frio, 1);
  assert.ok(p.riscos.carrega_peso >= 2);
  assert.ok(codigos(p, 'atividade_fisica', 20).includes('fortalecimento_lombar_20'));
  assert.deepEqual(inferirRiscosDoTexto('Operador de caixa: bipar produtos').regioes, new Set(['punhos', 'ombros']));
});

test('não repete desafio ativo, respeita intervalo de exames e não junta dois do mesmo grupo', () => {
  const p = perfilDe({ data_nascimento: '1975-01-01', sexo: 'F' });
  const historico = [
    { modelo_codigo: 'mamografia', status: 'concluido', concluido_em: '2026-03-01' },
    { modelo_codigo: 'yoga_30', status: 'ativo', created_at: '2026-10-28' },
  ];
  const prev = selecionarModelos(p, { categoria: 'saude_preventiva', quantidade: 20, historico, hoje: HOJE, aleatorio: fixo }).map((m) => m.codigo);
  assert.ok(!prev.includes('mamografia'));
  const fis = selecionarModelos(p, { categoria: 'atividade_fisica', quantidade: 20, historico, hoje: HOJE, aleatorio: fixo });
  assert.ok(!fis.some((m) => m.grupo === 'mente_corpo'), 'pilates não deve vir junto com yoga ativo');
  const grupos = fis.map((m) => m.grupo);
  assert.equal(new Set(grupos).size, grupos.length);
});

test('desafio instanciado traz descrição, comprovação, app, prazo e pontos', () => {
  const p = perfilDe({ data_nascimento: '2004-01-01', sexo: 'M' });
  const modelo = MODELOS.find((m) => m.codigo === 'alongamento_membros_superiores_15');
  const d = instanciarDesafio(modelo, p, { nome: 'Lucas Lima', hoje: HOJE });
  assert.match(d.como_comprovar, /Strava/);
  assert.match(d.app_sugerido, /Strava/);
  assert.equal(d.prazo, '2026-11-04');
  assert.equal(d.pontos, modelo.pontos + 2); // bônus: risco alto de repetição
  assert.equal(d.criterios.duracao_minima_min, 15);
  assert.equal(d.criterios.nome_colaborador, 'Lucas Lima');
  assert.match(d.motivo, /movimentos repetitivos/);
});
