import './setup.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { app } = await import('../src/server.js');
let servidor, base;
before(() => new Promise((ok) => { servidor = app.listen(0, () => { base = `http://localhost:${servidor.address().port}`; ok(); }); }));
after(() => servidor.close());

/** Cliente HTTP com cookie de sessão próprio. */
function cliente() {
  let cookie = '';
  return async (metodo, url, corpo) => {
    const headers = cookie ? { cookie } : {};
    let body;
    if (corpo instanceof FormData) body = corpo;
    else if (corpo !== undefined) { body = JSON.stringify(corpo); headers['content-type'] = 'application/json'; }
    const r = await fetch(base + url, { method: metodo, headers, body });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const ct = r.headers.get('content-type') ?? '';
    return { status: r.status, dados: ct.includes('json') ? await r.json() : await r.text() };
  };
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const arquivo = (buf, nome = 'print.png', tipo = 'image/png') => { const f = new FormData(); f.append('arquivo', new Blob([buf], { type: tipo }), nome); return f; };

const rh = cliente();
const colab = cliente();
let cargoId, setorId;

test('RH entra, é obrigado a trocar a senha e cadastra a estrutura', async () => {
  assert.equal((await rh('POST', '/api/auth/login', { matricula: 'rh', senha: '1234' })).dados.deve_trocar_senha, true);
  assert.equal((await rh('GET', '/api/rh/painel')).dados.codigo, 'TROCAR_SENHA');
  assert.equal((await rh('POST', '/api/auth/trocar-senha', { senha_atual: '1234', nova_senha: '1234' })).status, 400);
  assert.equal((await rh('POST', '/api/auth/trocar-senha', { senha_atual: '1234', nova_senha: 'rhforte99' })).status, 200);

  setorId = (await rh('POST', '/api/rh/setores', { nome: 'Frente de Caixa' })).dados.id;
  const cargo = await rh('POST', '/api/rh/cargos', {
    setor_id: setorId, nome: 'Operador de Caixa', descricao: 'Registra compras no caixa.',
    funcoes: [{ nome: 'Registrar produtos', descricao: 'Scanner o dia todo' }],
    riscos: { movimentos_repetitivos: 3, horas_em_pe: 4, regioes_sobrecarga: ['punhos', 'invalida'] },
  });
  assert.equal(cargo.status, 201);
  cargoId = cargo.dados.id;
  assert.equal(cargo.dados.riscos.regioes_sobrecarga, 'punhos');
  assert.equal(cargo.dados.funcoes.length, 1);
  const editado = await rh('PUT', `/api/rh/cargos/${cargoId}`, { descricao: 'Registra compras e carrega fardos.' });
  assert.equal(editado.dados.versao, 2);
});

test('RH importa planilha com prévia de erros e cadastra um a um', async () => {
  const csv = `nome;matricula;data_nascimento;sexo;setor;cargo
Maria Souza;5001;10/05/1976;F;Frente de Caixa;Operador de Caixa
Sem Data;5002;;M;Frente de Caixa;Operador de Caixa`;
  const fd = () => { const f = new FormData(); f.append('planilha', new Blob([csv]), 'colab.csv'); return f; };
  const previa = await rh('POST', '/api/rh/importacao/previa', fd());
  assert.deepEqual([previa.dados.resumo.validas, previa.dados.resumo.com_erro], [1, 1]);
  assert.equal((await rh('GET', '/api/rh/colaboradores')).dados.length, 0, 'prévia não grava nada');
  const conf = await rh('POST', '/api/rh/importacao/confirmar', fd());
  assert.equal(conf.dados.criados, 1);
  assert.equal(conf.dados.ignorados.length, 1);

  const novo = await rh('POST', '/api/rh/colaboradores', { nome: 'Lucas Lima', matricula: '5003', data_nascimento: '2005-02-01', sexo: 'M', setor_id: setorId, cargo_id: cargoId });
  assert.equal(novo.status, 201);
  assert.equal((await rh('POST', '/api/rh/colaboradores', { nome: 'X Y', matricula: '5003', data_nascimento: '2005-02-01', sexo: 'M', setor_id: setorId, cargo_id: cargoId })).status, 400);
});

test('colaborador: primeiro acesso, perfil, desafios, comprovante e pontos', async () => {
  assert.equal((await colab('POST', '/api/auth/login', { matricula: '5001', senha: 'errada' })).status, 401);
  await colab('POST', '/api/auth/login', { matricula: '5001', senha: '1234' });
  assert.equal((await colab('GET', '/api/painel')).status, 403);
  await colab('POST', '/api/auth/trocar-senha', { senha_atual: '1234', nova_senha: 'maria2026' });
  assert.equal((await colab('GET', '/api/rh/painel')).status, 403, 'colaborador não acessa o RH');

  const perfil = await colab('PUT', '/api/perfil', { altura_cm: 160, peso_kg: 70, atividades_preferidas: ['yoga', 'hack'], nivel_atividade: 'leve' });
  assert.equal(perfil.dados.perfil.atividades_preferidas, 'yoga');

  const painel = (await colab('GET', '/api/painel')).dados;
  assert.equal(painel.desafios.length, 3);
  assert.equal(painel.saldo, 0);
  const desafio = painel.desafios.find((d) => d.categoria === 'atividade_fisica');
  for (const campo of ['descricao', 'como_comprovar', 'prazo', 'pontos', 'app_sugerido']) assert.ok(desafio[campo], campo);
  assert.ok(painel.desafios.some((d) => ['mamografia', 'papanicolau'].includes(d.modelo_codigo)), 'rastreamento feminino para 50 anos');
  // gerar de novo não duplica
  assert.equal((await colab('GET', '/api/painel')).dados.desafios.length, 3);

  assert.equal((await colab('POST', `/api/desafios/${desafio.id}/comprovantes`, arquivo(Buffer.from('não é imagem'), 'x.png'))).status, 400);
  const envio = await colab('POST', `/api/desafios/${desafio.id}/comprovantes`, arquivo(PNG));
  assert.equal(envio.status, 201);
  assert.equal((await colab('POST', `/api/desafios/${desafio.id}/comprovantes`, arquivo(PNG))).status, 400, 'já em análise');
  await new Promise((r) => setTimeout(r, 100));

  // Sem chave da IA o comprovante fica para o RH; recusa e o colaborador reenvia
  const pendentes = (await rh('GET', '/api/rh/comprovantes?status=em_analise')).dados;
  assert.equal(pendentes.length, 1);
  assert.equal((await rh('POST', `/api/rh/comprovantes/${envio.dados.id}/decisao`, { status: 'recusado' })).status, 400, 'motivo obrigatório');
  await rh('POST', `/api/rh/comprovantes/${envio.dados.id}/decisao`, { status: 'recusado', motivo: 'Nome não aparece no print.' });
  let d = (await colab('GET', '/api/painel')).dados.desafios.find((x) => x.id === desafio.id);
  assert.equal(d.status, 'ativo');
  assert.equal(d.comprovantes[0].motivo, 'Nome não aparece no print.');

  const reenvio = await colab('POST', `/api/desafios/${desafio.id}/comprovantes`, arquivo(PNG, 'novo.png'));
  await new Promise((r) => setTimeout(r, 100));
  await rh('POST', `/api/rh/comprovantes/${reenvio.dados.id}/decisao`, { status: 'aprovado' });
  assert.equal((await rh('POST', `/api/rh/comprovantes/${reenvio.dados.id}/decisao`, { status: 'aprovado' })).status, 400, 'não pontua duas vezes');

  const pontos = (await colab('GET', '/api/pontos')).dados;
  assert.equal(pontos.saldo, desafio.pontos);
  assert.equal(pontos.lancamentos.length, 1);
  const concluidos = (await colab('GET', '/api/desafios/concluidos')).dados;
  assert.equal(concluidos[0].id, desafio.id);
  // um novo desafio físico entra no lugar do concluído
  const depois = (await colab('GET', '/api/painel')).dados;
  assert.equal(depois.desafios.length, 3);
  assert.ok(!depois.desafios.some((x) => x.id === desafio.id));
});

test('painel do RH mostra engajamento por setor e por colaborador', async () => {
  const p = (await rh('GET', '/api/rh/painel?dias=30')).dados;
  assert.equal(p.totais.colaboradores, 2);
  assert.equal(p.totais.engajados, 1);
  assert.equal(p.totais.engajamento, 50);
  assert.equal(p.totais.concluidos, 1);
  assert.equal(p.totais.recusados, 1);
  assert.equal(p.porSetor[0].setor, 'Frente de Caixa');
  assert.equal(p.cumpridos.length, 1);
  assert.equal(p.recusados[0].motivo, 'Nome não aparece no print.');
});

test('tela do exercício: detalhe do desafio e vídeo cadastrado pelo RH', async () => {
  const painel = (await colab('GET', '/api/painel')).dados;
  const d = painel.desafios.find((x) => x.categoria === 'atividade_fisica');
  const sem = (await colab('GET', `/api/desafios/${d.id}`)).dados;
  assert.equal(sem.titulo, d.titulo);
  assert.equal(sem.video, null);
  assert.equal(sem.criterios, undefined, 'critérios de validação não vão para o colaborador');

  assert.equal((await rh('PUT', `/api/rh/videos/${d.modelo_codigo}`, { url: 'https://exemplo.com/x' })).status, 400);
  assert.equal((await rh('PUT', `/api/rh/videos/${d.modelo_codigo}`, { url: 'https://youtu.be/abcdefghijk', titulo: 'Com a fisioterapeuta' })).status, 200);
  const com = (await colab('GET', `/api/desafios/${d.id}`)).dados;
  assert.deepEqual(com.video, { tipo: 'iframe', src: 'https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0', titulo: 'Com a fisioterapeuta', url: 'https://youtu.be/abcdefghijk' });
  assert.ok((await rh('GET', '/api/rh/videos')).dados.find((m) => m.codigo === d.modelo_codigo).video);
  assert.equal((await colab('PUT', `/api/rh/videos/${d.modelo_codigo}`, { url: '' })).status, 403);

  // desafio de outra pessoa não aparece
  const outro = cliente();
  await outro('POST', '/api/auth/login', { matricula: '5003', senha: '1234' });
  await outro('POST', '/api/auth/trocar-senha', { senha_atual: '1234', nova_senha: 'lucas2026' });
  assert.equal((await outro('GET', `/api/desafios/${d.id}`)).status, 404);
});

test('recompensas (fase 2) ficam desligadas', async () => {
  assert.equal((await colab('GET', '/api/recompensas')).status, 404);
});
