// Portal Viva Bem: SPA sem dependências. Todo HTML dinâmico passa por esc().
import { MOVIMENTOS, cuidadosFisicos, desenhar, guiaDe, instanteTipico, lembreteApp, preparoPreventivo } from './exercicios.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const app = $('#app');
let sessao = null;
let temporizador = null;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataBR = (v) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '—');
const dataHoraBR = (v) => (v ? `${dataBR(v)} ${v.slice(11, 16)}` : '—');
const diasAte = (data) => Math.ceil((new Date(`${data}T23:59:59`) - new Date()) / 86_400_000);

const ROTULOS = {
  atividade_fisica: 'Atividade física', saude_preventiva: 'Saúde preventiva',
  ativo: 'Ativo', em_analise: 'Em análise', concluido: 'Concluído', expirado: 'Expirado', aprovado: 'Aprovado', recusado: 'Recusado',
  sedentario: 'Sedentário (quase não me exercito)', leve: 'Leve (1 a 2 vezes por semana)', moderado: 'Moderado (3 a 4 vezes por semana)', intenso: 'Intenso (5 ou mais vezes por semana)',
  impacto_articular: 'Evitar impacto (joelhos, tornozelos)', coluna: 'Problema na coluna', cardiaca: 'Condição cardíaca', gestante: 'Gestante',
  caminhada: 'Caminhada', corrida: 'Corrida', ciclismo: 'Ciclismo', natacao: 'Natação', yoga: 'Yoga', pilates: 'Pilates', musculacao: 'Musculação / funcional', danca: 'Dança',
  F: 'Feminino', M: 'Masculino', O: 'Outro',
  desafio: 'Desafio', resgate: 'Resgate', estorno: 'Estorno', ajuste: 'Ajuste',
};
const REGIOES = { punhos: 'Punhos e mãos', ombros: 'Ombros', pescoco: 'Pescoço', coluna: 'Coluna', pernas: 'Pernas' };
const rotulo = (k) => ROTULOS[k] ?? k;
const etiqueta = (k) => `<span class="etiqueta ${esc(k)}">${esc(rotulo(k))}</span>`;

async function api(metodo, url, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo instanceof FormData) opcoes.body = corpo;
  else if (corpo !== undefined) { opcoes.body = JSON.stringify(corpo); opcoes.headers['content-type'] = 'application/json'; }
  const resp = await fetch(url, opcoes);
  const dados = resp.headers.get('content-type')?.includes('json') ? await resp.json() : null;
  if (resp.status === 401 && !url.endsWith('/login')) { sessao = null; location.hash = '#/login'; }
  if (resp.status === 403 && dados?.codigo === 'TROCAR_SENHA') { location.hash = '#/trocar-senha'; }
  if (!resp.ok) throw new Error(dados?.erro ?? 'Algo deu errado. Tente novamente.');
  return dados;
}

function avisar(texto) {
  const el = $('#aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { el.hidden = true; }, 4000);
}

function irPara(hash) {
  if (location.hash === hash) navegar();
  else location.hash = hash;
}

const msg = (texto, tipo = 'erro') => (texto ? `<div class="msg ${tipo}">${esc(texto)}</div>` : '');

/** Liga um formulário a uma ação assíncrona, mostrando erros e travando o botão enquanto envia. */
function aoEnviar(form, acao) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = $('button[type=submit]', form);
    const saida = $('.saida', form);
    if (botao) botao.disabled = true;
    if (saida) saida.innerHTML = '';
    try { await acao(new FormData(form)); }
    catch (err) { if (saida) saida.innerHTML = msg(err.message); else avisar(err.message); }
    finally { if (botao) botao.disabled = false; }
  });
}

function abrirDialogo(html, aoMontar) {
  const d = document.createElement('dialog');
  d.innerHTML = `<div class="conteudo">${html}</div>`;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-fechar]')) d.close(); });
  aoMontar?.(d);
  d.showModal();
  return d;
}

// ====================== Rotas ======================

const MENU = {
  colaborador: [['#/inicio', 'Meus desafios'], ['#/pausa', 'Pausa ativa'], ['#/ranking', 'Ranking'], ['#/pontos', 'Meus pontos'],
    ['#/recompensas', 'Recompensas', true], ['#/concluidos', 'Concluídos'], ['#/perfil', 'Meu perfil']],
  rh: [['#/rh/painel', 'Painel'], ['#/rh/colaboradores', 'Colaboradores'], ['#/rh/estrutura', 'Lojas, setores e cargos'], ['#/rh/comprovantes', 'Comprovantes'],
    ['#/rh/recompensas', 'Recompensas', true], ['#/rh/videos', 'Vídeos']],
};

const ROTAS = {
  '#/login': telaLogin,
  '#/trocar-senha': telaTrocarSenha,
  '#/inicio': telaInicio,
  '#/pausa': telaPausa,
  '#/ranking': telaRanking,
  '#/desafio': telaDesafio,
  '#/pontos': telaPontos,
  '#/concluidos': telaConcluidos,
  '#/perfil': telaPerfil,
  '#/recompensas': telaRecompensas,
  '#/rh/painel': telaPainelRH,
  '#/rh/colaboradores': telaColaboradores,
  '#/rh/estrutura': telaEstrutura,
  '#/rh/comprovantes': telaComprovantes,
  '#/rh/videos': telaVideos,
  '#/rh/recompensas': telaRecompensasRH,
};

async function navegar() {
  clearTimeout(temporizador);
  if (!sessao) {
    try { sessao = (await api('GET', '/api/auth/sessao')).usuario; } catch { sessao = null; }
  }
  let rota = location.hash.split('?')[0] || '#/';
  // rotas com parâmetro: #/desafio/12
  const [, base, param] = rota.match(/^(#\/desafio)\/(\d+)$/) ?? [null, rota, null];
  if (!sessao) rota = '#/login';
  else if (sessao.deve_trocar_senha) rota = '#/trocar-senha';
  else if (!ROTAS[base] || (base === '#/desafio' && !param) || rota === '#/login' || rota === '#/trocar-senha'
    || (rota.startsWith('#/rh') !== (sessao.papel === 'rh'))) rota = sessao.papel === 'rh' ? '#/rh/painel' : '#/inicio';
  if (location.hash.split('?')[0] !== rota) { location.hash = rota; return; }

  const logado = sessao && !sessao.deve_trocar_senha;
  $('#topo').hidden = !logado;
  if (logado) {
    $('#nome-usuario').textContent = sessao.nome;
    $('#menu').innerHTML = MENU[sessao.papel].filter(([, , recompensa]) => !recompensa || sessao.recursos?.recompensas).map(([href, texto]) =>
      `<a href="${href}" class="${rota === href || (base === '#/desafio' && href === '#/inicio') ? 'ativo' : ''}">${esc(texto)}</a>`).join('');
    $('#sino').hidden = sessao.papel !== 'colaborador';
    if (sessao.papel === 'colaborador') atualizarSino();
  }
  app.innerHTML = '<p class="suave">Carregando…</p>';
  try { await ROTAS[ROTAS[rota] ? rota : base](param); }
  catch (err) { app.innerHTML = msg(err.message); }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', navegar);
$('#sair').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout').catch(() => {});
  sessao = null;
  irPara('#/login');
});
navegar();

// ====================== Acesso ======================

function telaLogin() {
  app.innerHTML = `
    <div class="login card">
      <div class="marca"><span class="logo"></span> Viva Bem</div>
      <p class="suave" style="text-align:center">Portal de saúde e bem-estar dos colaboradores</p>
      <form id="f-login">
        <div class="saida"></div>
        <div class="campo"><label for="matricula">Matrícula</label><input id="matricula" name="matricula" required autocomplete="username" inputmode="text"></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" name="senha" type="password" required autocomplete="current-password"></div>
        <button type="submit" style="width:100%">Entrar</button>
        <p class="ajuda" style="margin-top:.75rem">No primeiro acesso, use a senha inicial informada pelo RH. Esqueceu a senha? Procure o RH da sua loja.</p>
      </form>
    </div>`;
  $('#matricula').focus();
  aoEnviar($('#f-login'), async (f) => {
    await api('POST', '/api/auth/login', { matricula: f.get('matricula'), senha: f.get('senha') });
    sessao = null;
    irPara('#/');
  });
}

function telaTrocarSenha() {
  app.innerHTML = `
    <div class="login card">
      <h1>Crie a sua senha</h1>
      <p class="suave">Olá, ${esc(sessao.nome.split(' ')[0])}! Por segurança, troque a senha inicial antes de continuar.</p>
      <form id="f-senha">
        <div class="saida"></div>
        <div class="campo"><label for="atual">Senha atual</label><input id="atual" name="atual" type="password" required autocomplete="current-password"></div>
        <div class="campo"><label for="nova">Nova senha</label><input id="nova" name="nova" type="password" required minlength="6" autocomplete="new-password">
          <span class="ajuda">Mínimo de 6 caracteres, com letras e números. Não use a matrícula.</span></div>
        <div class="campo"><label for="conf">Confirme a nova senha</label><input id="conf" name="conf" type="password" required autocomplete="new-password"></div>
        <button type="submit" style="width:100%">Salvar e continuar</button>
      </form>
    </div>`;
  aoEnviar($('#f-senha'), async (f) => {
    if (f.get('nova') !== f.get('conf')) throw new Error('As senhas não conferem.');
    await api('POST', '/api/auth/trocar-senha', { senha_atual: f.get('atual'), nova_senha: f.get('nova') });
    sessao = null;
    avisar('Senha alterada com sucesso.');
    irPara('#/');
  });
}

// ====================== Colaborador ======================

function cartaoDesafio(d) {
  const dias = diasAte(d.prazo);
  const ultimo = d.comprovantes[0];
  const podeEnviar = d.status === 'ativo';
  return `
  <article class="card desafio">
    <div class="topo">
      <div>${etiqueta(d.categoria)} ${d.status === 'em_analise' ? etiqueta('em_analise') : ''}</div>
      <span class="pontos">+${d.pontos} pts</span>
    </div>
    <h2>${esc(d.titulo)}</h2>
    <p>${esc(d.descricao)}</p>
    <div class="motivo">${esc(d.motivo)}</div>
    <dl class="detalhe">
      <dt>Como comprovar</dt><dd>${esc(d.como_comprovar)}</dd>
      ${d.app_sugerido ? `<dt>App indicado</dt><dd>${esc(d.app_sugerido)}</dd>` : ''}
      <dt>Prazo</dt><dd>${dataBR(d.prazo)} · ${dias <= 0 ? 'último dia' : `${dias} dia${dias > 1 ? 's' : ''} restante${dias > 1 ? 's' : ''}`}</dd>
    </dl>
    ${ultimo ? `<div class="comprovante ${esc(ultimo.status)}">
        <div class="linha entre"><strong>Último comprovante</strong>${etiqueta(ultimo.status)}</div>
        ${ultimo.status === 'em_analise' && !ultimo.motivo ? '<span class="suave">Analisando o seu comprovante…</span>' : `<span>${esc(ultimo.motivo ?? '')}</span>`}
      </div>` : ''}
    <a class="botao secundario como-fazer" href="#/desafio/${d.id}">${d.categoria === 'atividade_fisica' ? '▶ Ver como fazer (vídeo e treino guiado)' : 'Ver passo a passo'}</a>
    ${podeEnviar ? formComprovante(d, ultimo) : ''}
  </article>`;
}

function formComprovante(d, ultimo = d.comprovantes[0]) {
  return `
    <form class="f-comprovante" data-id="${d.id}">
      <div class="saida"></div>
      <label for="arq-${d.id}">${ultimo?.status === 'recusado' ? 'Enviar novo comprovante' : 'Enviar comprovante'}</label>
      <div class="linha">
        <input id="arq-${d.id}" type="file" name="arquivo" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" required style="flex:1">
        <button type="submit">Enviar</button>
      </div>
      <span class="ajuda">Print (JPG, PNG) ou PDF de até 10 MB.</span>
    </form>`;
}

function ligarComprovantes(depois) {
  $$('.f-comprovante').forEach((form) => aoEnviar(form, async (f) => {
    await api('POST', `/api/desafios/${form.dataset.id}/comprovantes`, f);
    avisar('Comprovante enviado! A validação leva alguns instantes.');
    await depois();
  }));
}

async function telaInicio() {
  const p = await api('GET', '/api/painel');
  const ativos = p.desafios;
  app.innerHTML = `
    <div class="saudacao">
      <div><h1>Olá, ${esc(p.nome.split(' ')[0])}!</h1>
        <p class="suave">Seus desafios foram escolhidos de acordo com a sua idade, o seu perfil e a rotina do seu cargo.</p></div>
      <div class="saldo">Seu saldo<strong>${p.saldo} pts</strong><span class="pequeno">${p.concluidos} desafio(s) concluído(s)</span></div>
    </div>
    ${ativos.length ? `<div class="grade cols-2">${ativos.map(cartaoDesafio).join('')}</div>`
      : '<div class="card vazio">Você está em dia! Novos desafios aparecem aqui assim que os atuais forem concluídos.</div>'}
    <p class="ajuda" style="margin-top:1.5rem">As sugestões de saúde preventiva seguem orientações gerais e não substituem a avaliação do seu médico. Respeite seus limites; se sentir dor, pare a atividade.</p>`;

  ligarComprovantes(telaInicio);
  // Enquanto houver comprovante em análise, atualiza a tela periodicamente.
  if (ativos.some((d) => d.status === 'em_analise')) {
    temporizador = setTimeout(() => { if (location.hash === '#/inicio' && !document.querySelector('dialog')) telaInicio().catch(() => {}); }, 5000);
  }
}

async function telaPontos() {
  const { saldo, lancamentos } = await api('GET', '/api/pontos');
  app.innerHTML = `
    <div class="saudacao"><h1>Meus pontos</h1><div class="saldo">Saldo atual<strong>${saldo} pts</strong></div></div>
    <div class="card">
      <h2>Histórico</h2>
      ${lancamentos.length ? `<div class="tabela"><table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th class="num">Pontos</th></tr></thead>
        <tbody>${lancamentos.map((l) => `<tr><td>${dataBR(l.created_at)}</td><td>${esc(l.descricao)}</td><td>${esc(rotulo(l.origem))}</td>
          <td class="num" style="color:${l.pontos >= 0 ? 'var(--primaria-escura)' : 'var(--erro)'}">${l.pontos > 0 ? '+' : ''}${l.pontos}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="vazio">Você ainda não tem pontos. Conclua um desafio para começar!</p>'}
    </div>`;
}

async function telaConcluidos() {
  const lista = await api('GET', '/api/desafios/concluidos');
  app.innerHTML = `
    <h1>Desafios concluídos</h1>
    ${lista.length ? `<div class="grade cols-3">${lista.map((d) => `
      <div class="card"><div class="linha entre">${etiqueta(d.categoria)}<span class="pontos">+${d.pontos} pts</span></div>
        <h3 style="margin-top:.6rem">${esc(d.titulo)}</h3><p class="suave pequeno">Concluído em ${dataBR(d.concluido_em)}</p></div>`).join('')}</div>`
      : '<div class="card vazio">Nenhum desafio concluído ainda.</div>'}`;
}

async function telaPerfil() {
  const { perfil: u, opcoes } = await api('GET', '/api/perfil');
  const marcados = (csv) => new Set((csv ?? '').split(',').filter(Boolean));
  const pref = marcados(u.atividades_preferidas);
  const restr = marcados(u.restricoes);
  app.innerHTML = `
    <h1>Meu perfil</h1>
    <div class="grade cols-2">
      <div class="card">
        <h2>Dados do cadastro</h2>
        <p class="suave pequeno">Esses dados são mantidos pelo RH. Se algo estiver errado, avise o RH.</p>
        <dl class="detalhe">
          <dt>Nome</dt><dd>${esc(u.nome)}</dd><dt>Matrícula</dt><dd>${esc(u.matricula)}</dd>
          <dt>Data de nascimento</dt><dd>${dataBR(u.data_nascimento)} (${u.idade ?? '—'} anos)</dd><dt>Sexo</dt><dd>${esc(rotulo(u.sexo))}</dd>
          <dt>Loja</dt><dd>${esc(u.loja ?? '—')}</dd><dt>Setor</dt><dd>${esc(u.setor ?? '—')}</dd><dt>Cargo</dt><dd>${esc(u.cargo ?? '—')}</dd>
        </dl>
        <hr style="border:none;border-top:1px solid var(--borda);margin:1rem 0">
        <h2>Trocar senha</h2>
        <form id="f-senha">
          <div class="saida"></div>
          <div class="campos">
            <div class="campo"><label for="sa">Senha atual</label><input id="sa" name="atual" type="password" required autocomplete="current-password"></div>
            <div class="campo"><label for="sn">Nova senha</label><input id="sn" name="nova" type="password" required minlength="6" autocomplete="new-password"></div>
          </div>
          <button type="submit" class="secundario">Alterar senha</button>
        </form>
      </div>
      <form class="card" id="f-perfil">
        <h2>Complete o seu perfil</h2>
        <p class="suave pequeno">Quanto mais completo, mais certeiros ficam os seus desafios.</p>
        <div class="saida"></div>
        <div class="campos">
          <div class="campo"><label for="email">E-mail</label><input id="email" name="email" type="email" value="${esc(u.email)}"></div>
          <div class="campo"><label for="tel">Telefone</label><input id="tel" name="telefone" value="${esc(u.telefone)}"></div>
          <div class="campo"><label for="alt">Altura (cm)</label><input id="alt" name="altura_cm" type="number" min="100" max="230" value="${esc(u.altura_cm)}"></div>
          <div class="campo"><label for="peso">Peso (kg)</label><input id="peso" name="peso_kg" type="number" min="30" max="300" step="0.1" value="${esc(u.peso_kg)}"></div>
        </div>
        <div class="campo"><label for="nivel">Com que frequência você pratica atividade física?</label>
          <select id="nivel" name="nivel_atividade"><option value="">Selecione</option>
            ${['sedentario', 'leve', 'moderado', 'intenso'].map((n) => `<option value="${n}" ${u.nivel_atividade === n ? 'selected' : ''}>${esc(rotulo(n))}</option>`).join('')}
          </select></div>
        <div class="campo"><label>Atividades de que você gosta</label><div class="opcoes">
          ${opcoes.atividades.map((a) => `<label><input type="checkbox" name="atividades_preferidas" value="${a}" ${pref.has(a) ? 'checked' : ''}> ${esc(rotulo(a))}</label>`).join('')}
        </div></div>
        <div class="campo"><label>Restrições de saúde</label><div class="opcoes">
          ${opcoes.restricoes.map((r) => `<label><input type="checkbox" name="restricoes" value="${r}" ${restr.has(r) ? 'checked' : ''}> ${esc(rotulo(r))}</label>`).join('')}
        </div><span class="ajuda">Usamos estas informações só para evitar desafios inadequados para você.</span></div>
        <div class="campo"><label for="obs">Observações de saúde (opcional)</label><textarea id="obs" name="observacoes_saude">${esc(u.observacoes_saude)}</textarea></div>
        <div class="campo"><label>Lembretes de prazo e resultados</label><div class="opcoes">
          <label><input type="checkbox" name="aceita_email" ${u.aceita_email ? 'checked' : ''}> Quero receber por e-mail</label>
          <label><input type="checkbox" name="aceita_whatsapp" ${u.aceita_whatsapp ? 'checked' : ''}> Quero receber por WhatsApp</label>
        </div><span class="ajuda">Opcional. Os avisos também aparecem no sino do portal. Você pode desmarcar quando quiser.</span></div>
        <button type="submit">Salvar perfil</button>
      </form>
    </div>`;
  aoEnviar($('#f-perfil'), async (f) => {
    const dados = Object.fromEntries(['email', 'telefone', 'altura_cm', 'peso_kg', 'nivel_atividade', 'observacoes_saude'].map((k) => [k, f.get(k)]));
    dados.atividades_preferidas = f.getAll('atividades_preferidas');
    dados.restricoes = f.getAll('restricoes');
    dados.aceita_email = f.has('aceita_email');
    dados.aceita_whatsapp = f.has('aceita_whatsapp');
    await api('PUT', '/api/perfil', dados);
    avisar('Perfil atualizado. Os próximos desafios vão considerar essas informações.');
  });
  aoEnviar($('#f-senha'), async (f) => {
    await api('POST', '/api/auth/trocar-senha', { senha_atual: f.get('atual'), nova_senha: f.get('nova') });
    $('#f-senha').reset();
    avisar('Senha alterada.');
  });
}

// ====================== RH: painel ======================

async function telaPainelRH() {
  const q = new URLSearchParams(location.hash.split('?')[1]);
  const dias = q.get('dias') ?? '30';
  const loja = q.get('loja') ?? '';
  const p = await api('GET', `/api/rh/painel?dias=${dias}${loja ? `&loja_id=${loja}` : ''}`);
  const t = p.totais;
  const barra = (pct) => `<div class="barra" title="${pct}%"><span style="width:${pct}%"></span></div>`;
  const catConcluidos = Object.fromEntries(p.porCategoria.map((c) => [c.categoria, c.concluidos]));
  app.innerHTML = `
    <div class="linha entre" style="margin-bottom:1rem">
      <h1>Painel de engajamento</h1>
      <div class="linha">
        ${p.lojas.length ? `<label class="linha" style="font-weight:400">Loja
          <select id="f-loja" style="width:auto"><option value="">Todas</option>${p.lojas.map((l) => `<option value="${l.id}" ${String(l.id) === loja ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></label>` : ''}
        <label class="linha" style="font-weight:400">Período
          <select id="periodo" style="width:auto">${[7, 30, 90, 365].map((d) => `<option value="${d}" ${String(d) === dias ? 'selected' : ''}>Últimos ${d} dias</option>`).join('')}</select>
        </label>
      </div>
    </div>
    ${p.ia_habilitada ? '' : msg('A validação automática por IA está desligada (defina ANTHROPIC_API_KEY). Os comprovantes ficam aguardando revisão manual na aba Comprovantes.', 'alerta')}
    ${t.em_analise ? msg(`${t.em_analise} comprovante(s) aguardando análise.`, 'alerta') : ''}
    ${p.resgates_pendentes ? `<div class="msg alerta">${p.resgates_pendentes} resgate(s) de recompensa aguardando o RH. <a href="#/rh/recompensas">Ver resgates</a></div>` : ''}
    <div class="grade kpis">
      <div class="card kpi"><div class="valor">${t.engajamento}%</div><div class="rotulo">Engajamento (${t.engajados} de ${t.colaboradores})</div></div>
      <div class="card kpi"><div class="valor">${t.concluidos}</div><div class="rotulo">Desafios cumpridos</div></div>
      <div class="card kpi"><div class="valor">${catConcluidos.atividade_fisica ?? 0}</div><div class="rotulo">Atividades físicas</div></div>
      <div class="card kpi"><div class="valor">${catConcluidos.saude_preventiva ?? 0}</div><div class="rotulo">Exames/consultas preventivas</div></div>
      <div class="card kpi"><div class="valor">${t.recusados}</div><div class="rotulo">Comprovantes recusados</div></div>
      <div class="card kpi"><div class="valor">${t.pausas}</div><div class="rotulo">Pausas ativas feitas</div></div>
      <div class="card kpi"><div class="valor">${t.pontos}</div><div class="rotulo">Pontos distribuídos</div></div>
    </div>
    <p class="ajuda" style="margin:.5rem 0 1.25rem">Engajado = enviou pelo menos um comprovante no período.</p>

    <div class="grade cols-2" style="margin-bottom:1rem">
      <div class="card"><div class="linha entre"><h2>Ranking do mês por loja</h2><span class="ajuda">média de pontos por colaborador</span></div>
        ${tabelaRanking(p.ranking.lojas, null, 'Cadastre lojas e vincule os colaboradores para ver o ranking.')}</div>
      <div class="card"><h2>Lembretes</h2>
        <p class="pequeno">Os avisos de prazo saem automaticamente a cada hora: no sino do portal sempre,
          por e-mail ${p.canais.email ? '<span class="etiqueta aprovado">configurado</span>' : '<span class="etiqueta">não configurado</span>'}
          e por WhatsApp ${p.canais.whatsapp ? '<span class="etiqueta aprovado">configurado</span>' : '<span class="etiqueta">não configurado</span>'},
          para quem autorizou no perfil.</p>
        <button class="secundario pequeno" id="b-lembretes">Verificar prazos e enviar agora</button></div>
    </div>

    <div class="card" style="margin-bottom:1rem">
      <h2>Engajamento por setor</h2>
      <div class="tabela"><table><thead><tr><th>Setor</th><th class="num">Colaboradores</th><th class="num">Engajados</th><th style="width:22%">Engajamento</th><th class="num">Cumpridos</th><th class="num">Recusados</th><th class="num">Pontos</th></tr></thead>
      <tbody>${p.porSetor.map((s) => `<tr><td>${esc(s.setor)}</td><td class="num">${s.colaboradores}</td><td class="num">${s.engajados}</td>
        <td><div class="linha">${barra(s.engajamento)}<span class="pequeno">${s.engajamento}%</span></div></td>
        <td class="num">${s.concluidos}</td><td class="num">${s.recusados}</td><td class="num">${s.pontos}</td></tr>`).join('') || '<tr><td colspan="7" class="vazio">Sem dados.</td></tr>'}</tbody></table></div>
    </div>

    <div class="card" style="margin-bottom:1rem">
      <div class="linha entre"><h2>Por colaborador</h2><input id="filtro-colab" placeholder="Filtrar por nome, setor ou cargo" style="max-width:280px"></div>
      <div class="tabela"><table id="t-colab"><thead><tr><th>Colaborador</th><th>Setor / cargo</th><th class="num">Enviados</th><th class="num">Cumpridos</th><th class="num">Recusados</th><th class="num">Expirados</th><th class="num">Pontos no período</th><th class="num">Saldo</th><th>Último acesso</th></tr></thead>
      <tbody>${p.porColaborador.map((c) => `<tr data-busca="${esc(`${c.nome} ${c.matricula} ${c.setor} ${c.cargo}`.toLowerCase())}">
        <td>${esc(c.nome)}<div class="ajuda">${esc(c.matricula)}</div></td><td>${esc(c.setor ?? '—')}<div class="ajuda">${esc(c.cargo ?? '')}</div></td>
        <td class="num">${c.enviados}</td><td class="num">${c.concluidos}</td><td class="num">${c.recusados}</td><td class="num">${c.expirados}</td>
        <td class="num">${c.pontos_periodo}</td><td class="num">${c.saldo}</td><td class="pequeno">${c.ultimo_acesso ? dataBR(c.ultimo_acesso) : '<span class="suave">nunca</span>'}</td></tr>`).join('')}</tbody></table></div>
    </div>

    <div class="grade cols-2">
      <div class="card"><h2>Desafios cumpridos</h2>
        ${p.cumpridos.length ? `<div class="tabela"><table><tbody>${p.cumpridos.map((d) => `<tr><td>${esc(d.nome)}<div class="ajuda">${esc(d.setor ?? '')}</div></td>
          <td>${esc(d.titulo)}<div>${etiqueta(d.categoria)}</div></td><td class="num pequeno">${dataBR(d.concluido_em)}<div class="pontos">+${d.pontos}</div></td></tr>`).join('')}</tbody></table></div>`
          : '<p class="vazio">Nenhum desafio cumprido no período.</p>'}</div>
      <div class="card"><h2>Comprovantes recusados</h2>
        ${p.recusados.length ? `<div class="tabela"><table><tbody>${p.recusados.map((r) => `<tr><td>${esc(r.nome)}<div class="ajuda">${esc(r.setor ?? '')}</div></td>
          <td>${esc(r.desafio)}${r.suspeita_ia ? ' <span class="etiqueta recusado">suspeita de IA/edição</span>' : ''}<div class="ajuda">${esc(r.motivo)}</div></td>
          <td class="num pequeno">${dataBR(r.created_at)}<div><button class="link pequeno" data-ver="${r.id}">ver</button></div></td></tr>`).join('')}</tbody></table></div>`
          : '<p class="vazio">Nenhum comprovante recusado no período.</p>'}</div>
    </div>`;

  const filtrar = () => { location.hash = `#/rh/painel?dias=${$('#periodo').value}${$('#f-loja')?.value ? `&loja=${$('#f-loja').value}` : ''}`; };
  $('#periodo').addEventListener('change', filtrar);
  $('#f-loja')?.addEventListener('change', filtrar);
  $('#b-lembretes').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const r = await api('POST', '/api/rh/lembretes/executar'); avisar(`${r.enviados} lembrete(s) novo(s) enviado(s).`); }
    catch (err) { avisar(err.message); } finally { e.target.disabled = false; }
  });
  $('#filtro-colab').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('#t-colab tbody tr').forEach((tr) => { tr.hidden = !tr.dataset.busca.includes(q); });
  });
  $$('[data-ver]').forEach((b) => b.addEventListener('click', () => verComprovante(b.dataset.ver, telaPainelRH)));
}

// ====================== RH: colaboradores ======================

async function carregarEstrutura() {
  const [setores, { cargos }, lojas] = await Promise.all([api('GET', '/api/rh/setores'), api('GET', '/api/rh/cargos'), api('GET', '/api/rh/lojas')]);
  return { setores, cargos, lojas };
}

async function telaColaboradores() {
  const [lista, { setores, cargos, lojas }] = await Promise.all([api('GET', '/api/rh/colaboradores'), carregarEstrutura()]);
  app.innerHTML = `
    <div class="linha entre" style="margin-bottom:1rem">
      <h1>Colaboradores</h1>
      <div class="linha">
        <button class="secundario" id="b-gerar" title="Completa os desafios de todos os colaboradores ativos">Gerar desafios agora</button>
        <button class="secundario" id="b-importar">Importar planilha</button>
        <button id="b-novo">Novo colaborador</button>
      </div>
    </div>
    ${setores.length && cargos.length ? '' : msg('Cadastre os setores e os cargos antes de cadastrar colaboradores.', 'alerta')}
    <div class="card">
      <input id="busca" placeholder="Buscar por nome, matrícula, setor ou cargo" style="margin-bottom:.75rem">
      <div class="tabela"><table id="t-lista"><thead><tr><th>Nome</th><th>Matrícula</th><th>Nascimento</th><th>Sexo</th><th>Loja</th><th>Setor / cargo</th><th class="num">Saldo</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.map((c) => `<tr data-busca="${esc(`${c.nome} ${c.matricula} ${c.setor} ${c.cargo} ${c.loja ?? ''}`.toLowerCase())}">
        <td>${esc(c.nome)}</td><td>${esc(c.matricula)}</td><td>${dataBR(c.data_nascimento)}</td><td>${esc(c.sexo)}</td><td>${esc(c.loja ?? '—')}</td>
        <td>${esc(c.setor ?? '—')}<div class="ajuda">${esc(c.cargo ?? '')}</div></td><td class="num">${c.saldo}</td>
        <td>${c.ativo ? (c.deve_trocar_senha ? '<span class="etiqueta em_analise">aguardando 1º acesso</span>' : '<span class="etiqueta aprovado">ativo</span>') : '<span class="etiqueta">inativo</span>'}</td>
        <td><button class="link pequeno" data-editar="${c.id}">editar</button></td></tr>`).join('') || '<tr><td colspan="9" class="vazio">Nenhum colaborador cadastrado.</td></tr>'}</tbody></table></div>
    </div>`;

  $('#busca').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('#t-lista tbody tr[data-busca]').forEach((tr) => { tr.hidden = !tr.dataset.busca.includes(q); });
  });
  $('#b-novo').addEventListener('click', () => formColaborador(null, setores, cargos, lojas));
  $('#b-importar').addEventListener('click', () => dialogoImportacao());
  $('#b-gerar').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const r = await api('POST', '/api/rh/desafios/gerar'); avisar(`${r.desafios_criados} desafio(s) criados para ${r.colaboradores} colaborador(es).`); }
    catch (err) { avisar(err.message); } finally { e.target.disabled = false; }
  });
  $$('[data-editar]').forEach((b) => b.addEventListener('click', () => formColaborador(lista.find((c) => c.id === Number(b.dataset.editar)), setores, cargos, lojas)));
}

function formColaborador(c, setores, cargos, lojas = []) {
  const opcoesCargo = (setorId, selecionado) => cargos.filter((k) => k.setor_id === Number(setorId))
    .map((k) => `<option value="${k.id}" ${k.id === selecionado ? 'selected' : ''}>${esc(k.nome)}</option>`).join('');
  abrirDialogo(`
    <h2>${c ? 'Editar colaborador' : 'Novo colaborador'}</h2>
    ${c ? '' : '<p class="suave pequeno">O colaborador entra com a matrícula e a senha inicial <strong>1234</strong>, que precisará trocar no primeiro acesso.</p>'}
    <form id="f-colab">
      <div class="saida"></div>
      <div class="campos">
        <div class="campo"><label>Nome completo</label><input name="nome" required value="${esc(c?.nome)}"></div>
        <div class="campo"><label>Matrícula</label><input name="matricula" required value="${esc(c?.matricula)}"></div>
        <div class="campo"><label>Data de nascimento</label><input name="data_nascimento" type="date" required value="${esc(c?.data_nascimento)}"></div>
        <div class="campo"><label>Sexo</label><select name="sexo" required><option value="">Selecione</option>
          ${['F', 'M', 'O'].map((s) => `<option value="${s}" ${c?.sexo === s ? 'selected' : ''}>${rotulo(s)}</option>`).join('')}</select></div>
        <div class="campo"><label>Loja</label><select name="loja_id"><option value="">${lojas.length ? 'Selecione' : 'Nenhuma loja cadastrada'}</option>
          ${lojas.map((l) => `<option value="${l.id}" ${c?.loja_id === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></div>
        <div class="campo"><label>Setor</label><select name="setor_id" id="sel-setor" required><option value="">Selecione</option>
          ${setores.map((s) => `<option value="${s.id}" ${c?.setor_id === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></div>
        <div class="campo"><label>Cargo</label><select name="cargo_id" id="sel-cargo" required><option value="">Selecione</option>${c ? opcoesCargo(c.setor_id, c.cargo_id) : ''}</select></div>
      </div>
      ${c ? `<div class="campo opcoes"><label><input type="checkbox" name="ativo" ${c.ativo ? 'checked' : ''}> Colaborador ativo</label></div>` : ''}
      <div class="linha entre">
        <div>${c ? '<button type="button" class="perigo pequeno" id="b-reset">Redefinir senha para 1234</button>' : ''}</div>
        <div class="linha"><button type="button" class="secundario" data-fechar>Cancelar</button><button type="submit">Salvar</button></div>
      </div>
    </form>
    ${c ? '<hr style="border:none;border-top:1px solid var(--borda);margin:1rem 0"><h3>Desafios</h3><div id="hist-desafios" class="suave">Carregando…</div>' : ''}`,
  (d) => {
    $('#sel-setor', d).addEventListener('change', (e) => { $('#sel-cargo', d).innerHTML = `<option value="">Selecione</option>${opcoesCargo(e.target.value)}`; });
    aoEnviar($('#f-colab', d), async (f) => {
      const dados = Object.fromEntries(f);
      if (c) dados.ativo = f.has('ativo');
      await api(c ? 'PUT' : 'POST', c ? `/api/rh/colaboradores/${c.id}` : '/api/rh/colaboradores', dados);
      d.close();
      avisar('Colaborador salvo.');
      telaColaboradores();
    });
    if (c) {
      $('#b-reset', d).addEventListener('click', async () => {
        if (!confirm(`Redefinir a senha de ${c.nome} para 1234?`)) return;
        const r = await api('POST', `/api/rh/colaboradores/${c.id}/resetar-senha`);
        avisar(r.mensagem);
      });
      api('GET', `/api/rh/colaboradores/${c.id}/desafios`).then((lista) => {
        $('#hist-desafios', d).innerHTML = lista.length ? `<table><tbody>${lista.map((x) => `<tr><td>${esc(x.titulo)}<div class="ajuda">${esc(x.motivo)}</div></td>
          <td>${etiqueta(x.status)}</td><td class="num pequeno">${dataBR(x.created_at)}</td></tr>`).join('')}</tbody></table>` : 'Nenhum desafio gerado ainda (são gerados no primeiro acesso).';
      }).catch(() => {});
    }
  });
}

function dialogoImportacao() {
  abrirDialogo(`
    <h2>Importar colaboradores</h2>
    <p class="suave pequeno">A planilha (.xlsx ou .csv) precisa das colunas <strong>nome, matricula, data_nascimento, sexo, setor, cargo</strong>.
      Setor e cargo devem estar cadastrados. A coluna <strong>loja</strong> é opcional. <a href="/api/rh/importacao/modelo">Baixar modelo</a>.</p>
    <form id="f-import">
      <div class="saida"></div>
      <div class="linha"><input type="file" name="planilha" accept=".xlsx,.csv" required style="flex:1"><button type="submit">Conferir planilha</button></div>
    </form>
    <div id="previa"></div>`,
  (d) => {
    let arquivo = null;
    aoEnviar($('#f-import', d), async (f) => {
      arquivo = f.get('planilha');
      const r = await api('POST', '/api/rh/importacao/previa', f);
      if (r.erroGeral) { $('#previa', d).innerHTML = msg(r.erroGeral); return; }
      const { resumo } = r;
      $('#previa', d).innerHTML = `
        <div class="msg ${resumo.com_erro ? 'alerta' : 'ok'}" style="margin-top:1rem">
          ${resumo.total} linha(s) lidas: <strong>${resumo.validas} pronta(s) para importar</strong>, ${resumo.com_erro} com erro, ${resumo.com_aviso} com aviso.
          ${resumo.com_erro ? 'As linhas com erro não serão importadas; corrija a planilha e confira de novo, ou importe só as válidas.' : ''}</div>
        <div class="tabela" style="max-height:40vh;overflow:auto"><table><thead><tr><th>Linha</th><th>Nome</th><th>Matrícula</th><th>Setor / cargo</th><th>Situação</th></tr></thead>
        <tbody>${r.linhas.map((l) => `<tr class="${l.valido ? '' : 'erro'}"><td>${l.linha}</td><td>${esc(l.dados.nome)}</td><td>${esc(l.dados.matricula)}</td>
          <td>${esc(l.dados.setor)}<div class="ajuda">${esc(l.dados.cargo)}</div></td>
          <td>${l.valido ? '<span class="etiqueta aprovado">ok</span>' : ''}${l.erros.map((e) => `<div style="color:var(--erro)">• ${esc(e)}</div>`).join('')}
            ${l.avisos.map((a) => `<div style="color:var(--alerta)">• ${esc(a)}</div>`).join('')}</td></tr>`).join('')}</tbody></table></div>
        ${resumo.validas ? `<div class="linha" style="justify-content:flex-end;margin-top:1rem"><button id="b-confirmar">Importar ${resumo.validas} colaborador(es)</button></div>` : ''}`;
      $('#b-confirmar', d)?.addEventListener('click', async (e) => {
        e.target.disabled = true;
        try {
          const fd = new FormData();
          fd.append('planilha', arquivo);
          const res = await api('POST', '/api/rh/importacao/confirmar', fd);
          d.close();
          avisar(`Importação concluída: ${res.criados} criado(s), ${res.atualizados} atualizado(s), ${res.ignorados.length} ignorado(s).`);
          telaColaboradores();
        } catch (err) { avisar(err.message); e.target.disabled = false; }
      });
    });
  });
}

// ====================== RH: setores e cargos ======================

const NIVEIS = ['nenhum', 'baixo', 'médio', 'alto'];

async function telaEstrutura() {
  const { setores, cargos, lojas } = await carregarEstrutura();
  const nivel = (n) => NIVEIS[n] ?? '—';
  app.innerHTML = `
    <div class="linha entre" style="margin-bottom:1rem"><h1>Lojas</h1><button id="b-loja">Nova loja</button></div>
    <div class="card" style="margin-bottom:1.5rem">
      ${lojas.length ? `<div class="tabela"><table><thead><tr><th>Loja</th><th>Cidade</th><th class="num">Colaboradores</th><th></th></tr></thead><tbody>
        ${lojas.map((l) => `<tr><td>${esc(l.nome)}</td><td>${esc(l.cidade ?? '—')}</td><td class="num">${l.colaboradores}</td>
          <td style="text-align:right"><button class="link pequeno" data-ed-loja="${l.id}">editar</button>
          ${l.colaboradores ? '' : ` · <button class="link pequeno" data-del-loja="${l.id}" style="color:var(--erro)">excluir</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="suave">Nenhuma loja cadastrada. As lojas aparecem no ranking e no filtro do painel.</p>'}
    </div>
    <div class="linha entre" style="margin-bottom:1rem"><h1>Setores e cargos</h1><button id="b-setor">Novo setor</button></div>
    <p class="suave">Descreva o dia a dia de cada cargo e os riscos da rotina. O sistema usa essas informações (e também as palavras das descrições) para escolher os desafios. Mudanças valem para os próximos desafios gerados.</p>
    <div class="pilha">${setores.map((s) => {
      const doSetor = cargos.filter((c) => c.setor_id === s.id);
      return `<section class="card">
        <div class="linha entre"><div><h2>${esc(s.nome)}</h2><p class="suave pequeno">${esc(s.descricao ?? '')} · ${s.colaboradores} colaborador(es)</p></div>
          <div class="linha"><button class="secundario pequeno" data-ed-setor="${s.id}">Editar setor</button><button class="pequeno" data-novo-cargo="${s.id}">Novo cargo</button>
          ${doSetor.length || s.colaboradores ? '' : `<button class="perigo pequeno" data-del-setor="${s.id}">Excluir</button>`}</div></div>
        ${doSetor.length ? `<div class="grade cols-2" style="margin-top:.75rem">${doSetor.map((c) => {
          const r = c.riscos ?? {};
          return `<div class="card" style="box-shadow:none">
            <div class="linha entre"><h3>${esc(c.nome)}</h3><button class="link pequeno" data-ed-cargo="${c.id}">editar</button></div>
            <p class="pequeno">${esc(c.descricao ?? 'Sem descrição.')}</p>
            ${c.funcoes.length ? `<p class="pequeno"><strong>Funções:</strong> ${c.funcoes.map((f) => esc(f.nome)).join(' · ')}</p>` : ''}
            <p class="pequeno suave">Repetitivo: ${nivel(r.movimentos_repetitivos)} · Em pé: ${r.horas_em_pe ?? 0}h · Sentado: ${r.horas_sentado ?? 0}h · Peso: ${nivel(r.carrega_peso)}
              ${r.ambiente_frio ? ' · Frio' : ''}${r.ambiente_calor ? ' · Calor' : ''}${r.turno_noturno ? ' · Noturno' : ''} · Atendimento: ${nivel(r.atendimento_publico)}</p>
            <p class="ajuda">${c.colaboradores} colaborador(es) · versão ${c.versao}</p>
          </div>`;
        }).join('')}</div>` : '<p class="suave pequeno">Nenhum cargo cadastrado.</p>'}
      </section>`;
    }).join('') || '<div class="card vazio">Comece cadastrando os setores da loja.</div>'}</div>`;

  $('#b-setor').addEventListener('click', () => formSetor(null));
  $('#b-loja').addEventListener('click', () => formLoja(null));
  $$('[data-ed-loja]').forEach((b) => b.addEventListener('click', () => formLoja(lojas.find((l) => l.id === Number(b.dataset.edLoja)))));
  $$('[data-del-loja]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Excluir esta loja?')) return;
    try { await api('DELETE', `/api/rh/lojas/${b.dataset.delLoja}`); telaEstrutura(); } catch (err) { avisar(err.message); }
  }));
  $$('[data-ed-setor]').forEach((b) => b.addEventListener('click', () => formSetor(setores.find((s) => s.id === Number(b.dataset.edSetor)))));
  $$('[data-del-setor]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Excluir este setor?')) return;
    try { await api('DELETE', `/api/rh/setores/${b.dataset.delSetor}`); telaEstrutura(); } catch (err) { avisar(err.message); }
  }));
  $$('[data-novo-cargo]').forEach((b) => b.addEventListener('click', () => formCargo(null, Number(b.dataset.novoCargo))));
  $$('[data-ed-cargo]').forEach((b) => b.addEventListener('click', () => formCargo(cargos.find((c) => c.id === Number(b.dataset.edCargo)))));
}

function formLoja(l) {
  abrirDialogo(`<h2>${l ? 'Editar loja' : 'Nova loja'}</h2>
    <form id="f-loja"><div class="saida"></div>
      <div class="campos"><div class="campo"><label>Nome</label><input name="nome" required value="${esc(l?.nome)}" placeholder="Ex.: Loja Centro"></div>
      <div class="campo"><label>Cidade</label><input name="cidade" value="${esc(l?.cidade)}"></div></div>
      <div class="linha" style="justify-content:flex-end"><button type="button" class="secundario" data-fechar>Cancelar</button><button type="submit">Salvar</button></div>
    </form>`, (d) => aoEnviar($('#f-loja', d), async (f) => {
    await api(l ? 'PUT' : 'POST', l ? `/api/rh/lojas/${l.id}` : '/api/rh/lojas', Object.fromEntries(f));
    d.close();
    telaEstrutura();
  }));
}

function formSetor(s) {
  abrirDialogo(`<h2>${s ? 'Editar setor' : 'Novo setor'}</h2>
    <form id="f-setor"><div class="saida"></div>
      <div class="campo"><label>Nome</label><input name="nome" required value="${esc(s?.nome)}"></div>
      <div class="campo"><label>Descrição</label><textarea name="descricao">${esc(s?.descricao)}</textarea></div>
      <div class="linha" style="justify-content:flex-end"><button type="button" class="secundario" data-fechar>Cancelar</button><button type="submit">Salvar</button></div>
    </form>`, (d) => aoEnviar($('#f-setor', d), async (f) => {
    await api(s ? 'PUT' : 'POST', s ? `/api/rh/setores/${s.id}` : '/api/rh/setores', Object.fromEntries(f));
    d.close();
    telaEstrutura();
  }));
}

function formCargo(c, setorId = c?.setor_id) {
  const r = c?.riscos ?? {};
  const regioes = new Set((r.regioes_sobrecarga ?? '').split(',').filter(Boolean));
  const selNivel = (nome) => `<select name="${nome}">${NIVEIS.map((n, i) => `<option value="${i}" ${Number(r[nome] ?? 0) === i ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  const linhaFuncao = (f = {}) => `<div class="campos funcao" style="grid-template-columns:1fr 2fr auto;align-items:end">
      <div class="campo"><label>Função</label><input name="f_nome" value="${esc(f.nome)}" placeholder="Ex.: Registrar produtos"></div>
      <div class="campo"><label>O que a pessoa faz</label><input name="f_desc" value="${esc(f.descricao)}" placeholder="Ex.: passa os produtos no scanner o turno todo"></div>
      <div class="campo"><button type="button" class="link" data-remover>remover</button></div></div>`;
  abrirDialogo(`<h2>${c ? `Editar cargo: ${esc(c.nome)}` : 'Novo cargo'}</h2>
    <form id="f-cargo"><div class="saida"></div>
      <div class="campo"><label>Nome do cargo</label><input name="nome" required value="${esc(c?.nome)}"></div>
      <div class="campo"><label>Descrição da rotina</label><textarea name="descricao" placeholder="Descreva o dia a dia: postura, tarefas, ambiente…">${esc(c?.descricao)}</textarea></div>
      <h3>Funções do cargo</h3>
      <div id="funcoes">${(c?.funcoes?.length ? c.funcoes : [{}]).map(linhaFuncao).join('')}</div>
      <button type="button" class="secundario pequeno" id="b-add-funcao" style="margin-bottom:1rem">Adicionar função</button>
      <h3>Riscos da rotina</h3>
      <div class="campos">
        <div class="campo"><label>Movimentos repetitivos</label>${selNivel('movimentos_repetitivos')}</div>
        <div class="campo"><label>Carrega peso</label>${selNivel('carrega_peso')}</div>
        <div class="campo"><label>Atendimento ao público</label>${selNivel('atendimento_publico')}</div>
        <div class="campo"><label>Horas em pé por dia</label><input type="number" name="horas_em_pe" min="0" max="24" step="0.5" value="${esc(r.horas_em_pe ?? 0)}"></div>
        <div class="campo"><label>Horas sentado por dia</label><input type="number" name="horas_sentado" min="0" max="24" step="0.5" value="${esc(r.horas_sentado ?? 0)}"></div>
      </div>
      <div class="campo opcoes">
        <label><input type="checkbox" name="ambiente_frio" ${r.ambiente_frio ? 'checked' : ''}> Trabalha no frio</label>
        <label><input type="checkbox" name="ambiente_calor" ${r.ambiente_calor ? 'checked' : ''}> Trabalha no calor</label>
        <label><input type="checkbox" name="turno_noturno" ${r.turno_noturno ? 'checked' : ''}> Turno noturno / madrugada</label>
      </div>
      <div class="campo"><label>Regiões do corpo mais exigidas</label><div class="opcoes">
        ${Object.entries(REGIOES).map(([g, nome]) => `<label><input type="checkbox" name="regioes" value="${g}" ${regioes.has(g) ? 'checked' : ''}> ${nome}</label>`).join('')}</div></div>
      <div class="campo"><label>Outros riscos / observações</label><textarea name="observacoes">${esc(r.observacoes)}</textarea></div>
      <div class="linha entre">
        <div>${c && !c.colaboradores ? '<button type="button" class="perigo pequeno" id="b-del-cargo">Excluir cargo</button>' : ''}</div>
        <div class="linha"><button type="button" class="secundario" data-fechar>Cancelar</button><button type="submit">Salvar</button></div>
      </div>
    </form>`, (d) => {
    $('#b-add-funcao', d).addEventListener('click', () => $('#funcoes', d).insertAdjacentHTML('beforeend', linhaFuncao()));
    $('#funcoes', d).addEventListener('click', (e) => { if (e.target.matches('[data-remover]')) e.target.closest('.funcao').remove(); });
    $('#b-del-cargo', d)?.addEventListener('click', async () => {
      if (!confirm('Excluir este cargo?')) return;
      try { await api('DELETE', `/api/rh/cargos/${c.id}`); d.close(); telaEstrutura(); } catch (err) { avisar(err.message); }
    });
    aoEnviar($('#f-cargo', d), async (f) => {
      const nomes = f.getAll('f_nome');
      const descs = f.getAll('f_desc');
      const corpo = {
        setor_id: setorId,
        nome: f.get('nome'),
        descricao: f.get('descricao'),
        funcoes: nomes.map((nome, i) => ({ nome, descricao: descs[i] })).filter((x) => x.nome.trim()),
        riscos: {
          movimentos_repetitivos: f.get('movimentos_repetitivos'), carrega_peso: f.get('carrega_peso'), atendimento_publico: f.get('atendimento_publico'),
          horas_em_pe: f.get('horas_em_pe'), horas_sentado: f.get('horas_sentado'),
          ambiente_frio: f.has('ambiente_frio'), ambiente_calor: f.has('ambiente_calor'), turno_noturno: f.has('turno_noturno'),
          regioes_sobrecarga: f.getAll('regioes'), observacoes: f.get('observacoes'),
        },
      };
      await api(c ? 'PUT' : 'POST', c ? `/api/rh/cargos/${c.id}` : '/api/rh/cargos', corpo);
      d.close();
      avisar('Cargo salvo. Os próximos desafios já consideram as mudanças.');
      telaEstrutura();
    });
  });
}

// ====================== RH: comprovantes ======================

async function telaComprovantes() {
  const status = new URLSearchParams(location.hash.split('?')[1]).get('status') ?? 'em_analise';
  const lista = await api('GET', `/api/rh/comprovantes${status === 'todos' ? '' : `?status=${status}`}`);
  app.innerHTML = `
    <h1>Comprovantes</h1>
    <div class="abas">${[['em_analise', 'Em análise'], ['recusado', 'Recusados'], ['aprovado', 'Aprovados'], ['todos', 'Todos']]
      .map(([k, t]) => `<button data-aba="${k}" class="${k === status ? 'ativo' : ''}">${t}</button>`).join('')}</div>
    <div class="card"><div class="tabela"><table><thead><tr><th>Enviado em</th><th>Colaborador</th><th>Desafio</th><th>Situação</th><th>Motivo</th><th></th></tr></thead>
    <tbody>${lista.map((c) => `<tr><td class="pequeno">${dataHoraBR(c.created_at)}</td><td>${esc(c.nome)}<div class="ajuda">${esc(c.matricula)} · ${esc(c.setor ?? '')}</div></td>
      <td>${esc(c.desafio)}<div>${etiqueta(c.categoria)}</div></td>
      <td>${etiqueta(c.status)}${c.suspeita_ia ? '<div><span class="etiqueta recusado">suspeita de IA/edição</span></div>' : ''}<div class="ajuda">${c.validado_por ? (c.validado_por === 'ia' ? 'validado pela IA' : 'validado pelo RH') : ''}</div></td>
      <td class="pequeno">${esc(c.motivo ?? '')}</td><td><button class="pequeno secundario" data-ver="${c.id}">Ver</button></td></tr>`).join('')
      || '<tr><td colspan="6" class="vazio">Nenhum comprovante aqui.</td></tr>'}</tbody></table></div></div>`;
  $$('[data-aba]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/rh/comprovantes?status=${b.dataset.aba}`; }));
  $$('[data-ver]').forEach((b) => b.addEventListener('click', () => verComprovante(b.dataset.ver, telaComprovantes)));
}

async function verComprovante(id, aoAlterar) {
  const c = await api('GET', `/api/rh/comprovantes/${id}`);
  const p = c.analise?.parecer;
  const url = `/api/rh/comprovantes/${id}/arquivo`;
  const crit = c.desafio.criterios;
  abrirDialogo(`
    <div class="linha entre"><h2>${esc(c.desafio.titulo)}</h2>${etiqueta(c.status)}</div>
    <p class="suave pequeno">Enviado em ${dataHoraBR(c.created_at)} · arquivo ${esc(c.nome_original)}</p>
    ${c.mime === 'application/pdf' ? `<iframe class="visualizador" src="${url}" title="Comprovante"></iframe>` : `<img class="visualizador" src="${url}" alt="Comprovante enviado">`}
    <p style="margin-top:.75rem"><a href="${url}" target="_blank" rel="noopener">Abrir em nova aba</a></p>
    <dl class="detalhe">
      <dt>Esperado</dt><dd>${esc(crit.nome_colaborador)} · ${crit.tipo === 'atividade' ? `${esc(crit.atividades_aceitas.join(', '))} · mínimo ${crit.duracao_minima_min} min` : esc(crit.exames_aceitos.join(', '))} · entre ${dataBR(crit.data_inicio)} e ${dataBR(crit.data_fim)}</dd>
      ${c.motivo ? `<dt>Motivo</dt><dd>${esc(c.motivo)}</dd>` : ''}
      ${p ? `<dt>Leitura da IA</dt><dd>${esc(p.tipo_documento)} · nome: ${esc(p.nome_encontrado ?? '—')} (${p.nome_confere ? 'confere' : 'não confere'}) ·
        data: ${dataBR(p.data_encontrada)} · ${esc(p.atividade_ou_exame_encontrado ?? '—')} (${p.tipo_confere ? 'confere' : 'não confere'})
        ${p.duracao_min_encontrada != null ? ` · ${Math.round(p.duracao_min_encontrada)} min` : ''}</dd>
        ${p.indicios_manipulacao?.length ? `<dt>Indícios de manipulação</dt><dd>${p.indicios_manipulacao.map(esc).join('; ')}</dd>` : ''}` : ''}
      ${c.analise?.marcasEdicao?.length || c.analise?.metadados?.marcasEdicao?.length ? `<dt>Metadados</dt><dd>Editores encontrados: ${esc((c.analise.marcasEdicao ?? c.analise.metadados.marcasEdicao).join(', '))}</dd>` : ''}
    </dl>
    ${c.status !== 'aprovado' ? `
    <form id="f-decisao" style="margin-top:1rem"><div class="saida"></div>
      <div class="campo"><label>Revisão manual do RH</label><textarea name="motivo" placeholder="Motivo (obrigatório para recusar)"></textarea></div>
      <div class="linha" style="justify-content:flex-end">
        ${c.status === 'em_analise' ? '<button type="button" class="secundario" id="b-reproc">Rodar validação por IA</button>' : ''}
        <button type="submit" name="status" value="recusado" class="perigo">Recusar</button>
        <button type="submit" name="status" value="aprovado">Aprovar</button>
      </div>
    </form>` : ''}
    <div class="linha" style="justify-content:flex-end;margin-top:1rem"><button class="secundario" data-fechar>Fechar</button></div>`,
  (d) => {
    const form = $('#f-decisao', d);
    if (!form) return;
    let escolha = null;
    $$('button[name=status]', form).forEach((b) => b.addEventListener('click', () => { escolha = b.value; }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('POST', `/api/rh/comprovantes/${id}/decisao`, { status: escolha, motivo: new FormData(form).get('motivo') });
        d.close();
        avisar('Decisão registrada.');
        aoAlterar?.();
      } catch (err) { $('.saida', form).innerHTML = msg(err.message); }
    });
    $('#b-reproc', d)?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { const r = await api('POST', `/api/rh/comprovantes/${id}/reprocessar`); d.close(); avisar(`Resultado: ${rotulo(r.status)}.`); aoAlterar?.(); }
      catch (err) { $('.saida', form).innerHTML = msg(err.message); e.target.disabled = false; }
    });
  });
}

// ====================== Tela do exercício ======================

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const duracaoTexto = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);

function midiaVideo(v) {
  return v.tipo === 'iframe'
    ? `<iframe src="${esc(v.src)}" title="${esc(v.titulo ?? 'Vídeo explicativo')}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`
    : `<video src="${esc(v.src)}" controls preload="metadata" playsinline></video>`;
}

async function telaDesafio(id) {
  const d = await api('GET', `/api/desafios/${id}`);
  const ultimo = d.comprovantes[0];
  const guia = d.categoria === 'atividade_fisica' ? guiaDe(d.modelo_codigo) : null;
  const dias = diasAte(d.prazo);
  const statusComprovante = ultimo ? `<div class="comprovante ${esc(ultimo.status)}" style="margin-bottom:.75rem">
      <div class="linha entre"><strong>Último comprovante</strong>${etiqueta(ultimo.status)}</div>
      <span>${esc(ultimo.motivo ?? (ultimo.status === 'em_analise' ? 'Analisando o seu comprovante…' : ''))}</span></div>` : '';
  const comprovar = `
    <section class="card">
      <h2>Comprovar o desafio</h2>
      <p class="pequeno">${esc(d.como_comprovar)}</p>
      ${statusComprovante}
      ${d.status === 'ativo' ? formComprovante(d, ultimo)
        : d.status === 'concluido' ? msg(`Desafio concluído! +${d.pontos} pontos no seu saldo.`, 'ok')
          : d.status === 'em_analise' ? '' : msg('O prazo deste desafio terminou.', 'alerta')}
    </section>`;

  const cabecalho = `
    <a class="voltar" href="#/inicio">← Meus desafios</a>
    <div class="cabecalho-desafio">
      <div><h1>${esc(d.titulo)}</h1>
        <div class="info">${etiqueta(d.categoria)} ${d.status !== 'ativo' ? etiqueta(d.status) : ''}
          <span class="suave pequeno">Prazo: ${dataBR(d.prazo)}${d.status === 'ativo' ? ` · ${dias <= 0 ? 'último dia' : `${dias} dia(s) restante(s)`}` : ''}</span></div></div>
      <span class="pontos" style="font-size:1.1rem">+${d.pontos} pts</span>
    </div>`;

  if (!guia) {
    const prep = preparoPreventivo(d.modelo_codigo);
    app.innerHTML = `${cabecalho}
      <div class="layout-exercicio">
        <div class="pilha">
          ${d.video ? `<section class="card player"><div class="palco-video">${midiaVideo(d.video)}</div>
            ${d.video.titulo ? `<p class="instrucao-atual" style="padding-top:.7rem">${esc(d.video.titulo)}</p>` : ''}</section>` : ''}
          <section class="card"><h2>Como fazer</h2><p>${esc(d.descricao)}</p>
            <ol class="lista-num">${prep.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></section>
          ${prep.extras.length ? `<section class="card"><h2>Preparo para este exame</h2><ul class="lista-check">${prep.extras.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></section>` : ''}
        </div>
        <div class="pilha">
          <div class="motivo">${esc(d.motivo)}</div>
          ${comprovar}
          <p class="ajuda">Esta orientação é geral e não substitui a avaliação do seu médico.</p>
        </div>
      </div>`;
    ligarComprovantes(() => telaDesafio(id));
    return;
  }

  const rodadas = guia.repeticoes ?? 1;
  const sequencia = Array.from({ length: rodadas }, (_, r) => guia.passos.map((p, i) => ({ ...p, rodada: r + 1, indice: i }))).flat();
  const total = sequencia.reduce((s, p) => s + p.tempo, 0);
  let faseAtual = null;
  const itens = guia.passos.map((p, i) => {
    const mov = MOVIMENTOS[p.mov];
    const fase = p.fase && p.fase !== faseAtual ? `<li class="fase">${esc(p.fase)}</li>` : '';
    if (p.fase) faseAtual = p.fase;
    return `${fase}<li data-passo="${i}" tabindex="0" role="button" aria-label="Ir para ${esc(mov.nome)}">
      <svg class="mini" viewBox="0 25 200 165" data-mov="${p.mov}" aria-hidden="true"></svg>
      <div><div class="nome">${esc(mov.nome)}</div>${p.nota ? `<div class="ajuda">${esc(p.nota)}</div>` : ''}</div>
      <span class="tempo">${duracaoTexto(p.tempo)}</span></li>`;
  }).join('');

  app.innerHTML = `${cabecalho}
    <div class="layout-exercicio">
      <div class="pilha">
        <section class="card player">
          ${d.video ? `<div class="abas" style="margin:0;padding:0 .6rem" role="tablist">
              <button class="ativo" data-modo="video" role="tab">Vídeo explicativo</button>
              <button data-modo="treino" role="tab">Treino guiado</button></div>
            <div id="modo-video"><div class="palco-video">${midiaVideo(d.video)}</div>
              ${d.video.titulo ? `<p class="instrucao-atual" style="padding-top:.7rem">${esc(d.video.titulo)}</p>` : ''}</div>` : ''}
          <div id="modo-treino" ${d.video ? 'hidden' : ''}>${htmlPlayer(total)}</div>
        </section>
        <section class="card">
          <h2>Antes de começar</h2>
          <p>${esc(guia.resumo)}</p>
          <div class="motivo">📱 ${esc(lembreteApp)}</div>
        </section>
        ${comprovar}
      </div>
      <div class="pilha">
        <section class="card">
          <div class="linha entre"><h2>Passo a passo</h2>${rodadas > 1 ? `<span class="etiqueta">repetir ${rodadas}×</span>` : ''}</div>
          <ol class="passos" id="lista-passos">${itens}</ol>
        </section>
        <section class="card"><h2>Dicas</h2><ul class="lista-check">${guia.dicas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
        <section class="aviso-cuidado"><h3>Cuidados</h3><ul class="lista-check">${cuidadosFisicos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
        <div class="motivo">${esc(d.motivo)}</div>
      </div>
    </div>`;

  $$('svg.mini').forEach((svg) => desenhar(svg, MOVIMENTOS[svg.dataset.mov], instanteTipico(MOVIMENTOS[svg.dataset.mov])));
  $$('[data-modo]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-modo]').forEach((x) => x.classList.toggle('ativo', x === b));
    $('#modo-video').hidden = b.dataset.modo !== 'video';
    $('#modo-treino').hidden = b.dataset.modo !== 'treino';
    // pausa o vídeo ao trocar de aba
    if (b.dataset.modo === 'treino') { const v = $('#modo-video video'); v?.pause(); const f = $('#modo-video iframe'); if (f) f.src = f.src; }
  }));
  ligarComprovantes(() => telaDesafio(id));
  iniciarPlayer(sequencia, total, rodadas);
}

function htmlPlayer(total) {
  return `
            <div class="palco">
              <svg id="cena" viewBox="-20 -28 240 222" role="img" aria-label="Demonstração animada do exercício"></svg>
              <div class="legenda">
                <div class="etapa" aria-live="polite"><span id="p-contagem"></span><strong id="p-nome"></strong></div>
                <div class="relogio pausado" id="p-relogio">00:00</div>
              </div>
              <span class="selo">Demonstração animada · repita o movimento do boneco</span>
              <div class="anuncio" id="p-anuncio" hidden></div>
            </div>
            <div class="progresso"><span id="p-barra" style="width:0%"></span></div>
            <div class="controles">
              <div class="grupo">
                <button class="icone secundario" id="p-ant" title="Exercício anterior" aria-label="Exercício anterior">⏮</button>
                <button class="icone play" id="p-play" title="Iniciar treino" aria-label="Iniciar treino">▶</button>
                <button class="icone secundario" id="p-prox" title="Próximo exercício" aria-label="Próximo exercício">⏭</button>
              </div>
              <div class="grupo pequeno">
                <label class="opcoes" style="font-weight:400"><input type="checkbox" id="p-voz" checked> Narração</label>
                <span class="suave" id="p-total">Total ${mmss(total)}</span>
              </div>
            </div>
            <div class="instrucao-atual"><p id="p-instrucao"></p><p class="ajuda" id="p-nota"></p></div>
          `;
}

/** Treino guiado: anima cada movimento, conta o tempo e narra as instruções. */
function iniciarPlayer(sequencia, total, rodadas, { aoIniciar, aoConcluir } = {}) {
  const cena = $('#cena');
  const st = { i: 0, restante: sequencia[0].tempo, rodando: false, inicio: performance.now(), ultimo: performance.now(), fim: false };
  const voz = 'speechSynthesis' in window ? window.speechSynthesis : null;
  if (!voz) $('#p-voz').closest('label').hidden = true;
  let audio;

  const falar = (texto) => {
    if (!voz || !$('#p-voz').checked) return;
    voz.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.rate = 1.02;
    const v = voz.getVoices().find((x) => x.lang?.toLowerCase().startsWith('pt'));
    if (v) u.voice = v;
    voz.speak(u);
  };
  const bip = () => {
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.15, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.25);
    } catch { /* sem áudio */ }
  };

  const passo = () => sequencia[st.i];
  const decorrido = () => sequencia.slice(0, st.i).reduce((s, p) => s + p.tempo, 0) + (passo().tempo - st.restante);

  function mostrar(anunciar) {
    const p = passo(), mov = MOVIMENTOS[p.mov];
    $('#p-nome').textContent = mov.nome;
    $('#p-contagem').textContent = `Exercício ${p.indice + 1} de ${sequencia.length / rodadas}${rodadas > 1 ? ` · rodada ${p.rodada} de ${rodadas}` : ''}`;
    $('#p-instrucao').textContent = mov.instrucao;
    $('#p-nota').textContent = p.nota ? `Duração: ${duracaoTexto(p.tempo)} (${p.nota})` : `Duração: ${duracaoTexto(p.tempo)}`;
    $$('#lista-passos li[data-passo]').forEach((li) => {
      const i = Number(li.dataset.passo);
      li.classList.toggle('atual', i === p.indice);
      li.classList.toggle('feito', p.rodada === rodadas ? i < p.indice : false);
    });
    st.inicio = performance.now();
    if (anunciar) falar(`${mov.nome}. ${p.nota ? `${p.nota}. ` : ''}${mov.instrucao}`);
    atualizarRelogio();
  }
  function atualizarRelogio() {
    $('#p-relogio').textContent = mmss(Math.ceil(st.restante));
    $('#p-relogio').classList.toggle('pausado', !st.rodando);
    $('#p-barra').style.width = `${Math.min(100, (decorrido() / total) * 100)}%`;
    $('#p-total').textContent = `Restam ${mmss(Math.max(0, total - decorrido()))}`;
    $('#p-play').textContent = st.rodando ? '⏸' : '▶';
    $('#p-play').setAttribute('aria-label', st.rodando ? 'Pausar' : 'Continuar');
  }
  function irPara(i, anunciar = st.rodando) {
    st.i = Math.max(0, Math.min(sequencia.length - 1, i));
    st.restante = passo().tempo;
    st.fim = false;
    $('#p-anuncio').hidden = true;
    mostrar(anunciar);
  }
  async function concluir() {
    st.rodando = false;
    st.fim = true;
    st.restante = 0;
    atualizarRelogio();
    let fim = { html: 'Treino concluído! 🎉<br><span style="font-size:1rem;font-weight:500">Salve a atividade no app e envie o print abaixo.</span>',
      fala: 'Parabéns, treino concluído! Salve a atividade no aplicativo e envie o print para ganhar seus pontos.' };
    if (aoConcluir) fim = await aoConcluir().catch((err) => ({ html: esc(err.message), fala: err.message }));
    $('#p-anuncio').innerHTML = fim.html;
    $('#p-anuncio').hidden = false;
    falar(fim.fala);
  }

  let iniciado = false;
  $('#p-play').addEventListener('click', async () => {
    if (st.fim) { irPara(0, false); iniciado = false; }
    if (!iniciado && aoIniciar) {
      try { await aoIniciar(); } catch (err) { avisar(err.message); return; }
    }
    iniciado = true;
    st.rodando = !st.rodando;
    st.ultimo = performance.now();
    if (st.rodando) { bip(); falar(`${MOVIMENTOS[passo().mov].nome}. ${MOVIMENTOS[passo().mov].instrucao}`); } else voz?.cancel();
    atualizarRelogio();
  });
  $('#p-prox').addEventListener('click', () => {
    if (st.fim) return;
    if (st.i < sequencia.length - 1) irPara(st.i + 1); else concluir();
  });
  $('#p-ant').addEventListener('click', () => irPara(st.restante < passo().tempo - 3 ? st.i : st.i - 1));
  $('#lista-passos').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-passo]');
    if (!li) return;
    const rodadaAtual = passo().rodada;
    irPara(sequencia.findIndex((p) => p.rodada === rodadaAtual && p.indice === Number(li.dataset.passo)));
    $('#modo-treino').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#lista-passos').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } });

  function quadro(agora) {
    if (!cena.isConnected) { voz?.cancel(); return; } // saiu da tela
    if (st.rodando) {
      st.restante -= (agora - st.ultimo) / 1000;
      if (st.restante <= 0) {
        bip();
        if (st.i < sequencia.length - 1) irPara(st.i + 1, true); else concluir();
      }
      atualizarRelogio();
    }
    st.ultimo = agora;
    desenhar(cena, MOVIMENTOS[passo().mov], (agora - st.inicio) / 1000);
    requestAnimationFrame(quadro);
  }
  mostrar(false);
  requestAnimationFrame(quadro);
}

// ====================== RH: vídeos explicativos ======================

async function telaVideos() {
  const lista = await api('GET', '/api/rh/videos');
  const linha = (m) => `
    <tr><td>${esc(m.titulo)}<div>${etiqueta(m.categoria)}</div></td>
      <td><form class="f-video linha" data-codigo="${esc(m.codigo)}" style="flex-wrap:nowrap">
        <input name="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(m.video?.url)}" style="min-width:220px">
        <input name="titulo" placeholder="Título (opcional)" value="${esc(m.video?.titulo)}" style="max-width:200px">
        <button type="submit" class="pequeno">Salvar</button></form>
        <div class="saida-video ajuda">${m.video ? `Vídeo ativo · atualizado em ${dataBR(m.video.atualizado_em)}` : (m.categoria === 'atividade_fisica' ? 'Sem vídeo: o colaborador vê a demonstração animada.' : 'Sem vídeo: o colaborador vê o passo a passo em texto.')}</div></td></tr>`;
  app.innerHTML = `
    <h1>Vídeos explicativos</h1>
    <p class="suave">Cole o link de um vídeo do YouTube ou Vimeo, ou de um arquivo .mp4. Por exemplo, um vídeo gravado com o fisioterapeuta ou o educador físico da empresa. Ele aparece na tela "Como fazer" do desafio, junto com o treino guiado animado. Para remover, apague o link e salve.</p>
    <div class="card"><div class="tabela"><table><thead><tr><th>Desafio</th><th>Vídeo</th></tr></thead>
      <tbody>${lista.map(linha).join('')}</tbody></table></div></div>`;
  $$('.f-video').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const saida = form.nextElementSibling;
    try {
      const r = await api('PUT', `/api/rh/videos/${form.dataset.codigo}`, { url: f.get('url'), titulo: f.get('titulo') });
      saida.textContent = r.removido ? 'Vídeo removido.' : 'Vídeo salvo e ativo.';
      saida.style.color = 'var(--primaria-escura)';
    } catch (err) { saida.textContent = err.message; saida.style.color = 'var(--erro)'; }
  }));
}

// ====================== Avisos (sino) ======================

async function atualizarSino() {
  try {
    const { nao_lidas: n } = await api('GET', '/api/notificacoes');
    $('#sino-n').textContent = n > 9 ? '9+' : n;
    $('#sino-n').hidden = !n;
    $('#sino').setAttribute('aria-label', n ? `Avisos: ${n} não lido(s)` : 'Avisos');
  } catch { /* sem avisos */ }
}

$('#sino').addEventListener('click', async () => {
  const { itens } = await api('GET', '/api/notificacoes');
  abrirDialogo(`
    <div class="linha entre"><h2>Avisos</h2><button class="secundario pequeno" data-fechar>Fechar</button></div>
    ${itens.length ? `<ul class="avisos">${itens.map((n) => `
      <li class="${n.lida ? '' : 'nova'}">${n.link ? `<a href="${esc(n.link)}" data-fechar>` : '<div>'}
        <strong>${esc(n.titulo)}</strong><span>${esc(n.mensagem)}</span><span class="ajuda">${dataHoraBR(n.created_at)}</span>
      ${n.link ? '</a>' : '</div>'}</li>`).join('')}</ul>` : '<p class="vazio">Nenhum aviso por enquanto.</p>'}`);
  await api('POST', '/api/notificacoes/lidas').catch(() => {});
  atualizarSino();
});

// ====================== Ranking ======================

const medalha = (pos) => ['🥇', '🥈', '🥉'][pos - 1] ?? `${pos}º`;

function tabelaRanking(lista, destaque, vazio = 'Sem dados neste mês.') {
  if (!lista.length) return `<p class="vazio">${esc(vazio)}</p>`;
  const max = Math.max(...lista.map((g) => g.media), 1);
  return `<div class="tabela"><table class="ranking"><thead><tr><th></th><th></th><th style="width:30%">Média por pessoa</th><th class="num">Participação</th><th class="num">Desafios</th></tr></thead>
    <tbody>${lista.map((g) => `<tr class="${g.id === destaque ? 'meu' : ''}"><td class="posicao">${medalha(g.posicao)}</td>
      <td><strong>${esc(g.nome)}</strong>${g.id === destaque ? ' <span class="etiqueta aprovado">você</span>' : ''}<div class="ajuda">${g.colaboradores} pessoa(s)</div></td>
      <td><div class="linha"><div class="barra" style="flex:1"><span style="width:${(g.media / max) * 100}%"></span></div><span class="pequeno">${g.media} pts</span></div></td>
      <td class="num">${g.participacao}%</td><td class="num">${g.desafios}</td></tr>`).join('')}</tbody></table></div>`;
}

async function telaRanking() {
  const mes = new URLSearchParams(location.hash.split('?')[1]).get('mes') ?? '';
  const r = await api('GET', `/api/ranking${mes ? `?mes=${mes}` : ''}`);
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });
  const nomeMes = (m) => new Date(`${m}-15`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const minhaLoja = r.lojas.find((l) => l.id === r.minha_loja);
  const meuSetor = r.setores.find((s) => s.id === r.meu_setor);
  app.innerHTML = `
    <div class="linha entre" style="margin-bottom:1rem">
      <div><h1>Ranking de ${esc(nomeMes(r.mes))}</h1>
        <p class="suave">Quem cuida mais da saúde? A classificação usa a <strong>média de pontos por pessoa</strong>, então equipes pequenas e grandes competem de igual para igual.</p></div>
      <select id="mes" style="width:auto">${meses.map((m) => `<option value="${m}" ${m === r.mes ? 'selected' : ''}>${esc(nomeMes(m))}</option>`).join('')}</select>
    </div>
    ${minhaLoja || meuSetor ? `<div class="grade kpis" style="margin-bottom:1rem">
      ${minhaLoja ? `<div class="card kpi"><div class="valor">${medalha(minhaLoja.posicao)}</div><div class="rotulo">Sua loja (${esc(minhaLoja.nome)}) entre ${r.lojas.length}</div></div>` : ''}
      ${meuSetor ? `<div class="card kpi"><div class="valor">${medalha(meuSetor.posicao)}</div><div class="rotulo">Seu setor (${esc(meuSetor.nome)}) entre ${r.setores.length}</div></div>` : ''}
    </div>` : ''}
    <div class="grade cols-2">
      <section class="card"><h2>Lojas</h2>${tabelaRanking(r.lojas, r.minha_loja)}</section>
      <section class="card"><h2>Setores</h2>${tabelaRanking(r.setores, r.meu_setor)}</section>
    </div>
    <p class="ajuda" style="margin-top:1rem">Contam os pontos de desafios cumpridos e de pausas ativas no mês. Participação = % de pessoas que pontuaram.</p>`;
  $('#mes').addEventListener('change', (e) => { location.hash = `#/ranking?mes=${e.target.value}`; });
}

// ====================== Pausa ativa ======================

async function telaPausa() {
  const p = await api('GET', '/api/pausa-ativa');
  const sequencia = p.passos.map((x, i) => ({ ...x, rodada: 1, indice: i }));
  let fase = null;
  app.innerHTML = `
    <div class="cabecalho-desafio">
      <div><h1>Pausa ativa</h1>
        <p class="suave">${Math.round(p.duracao / 60)} minutos de alongamento para fazer em pé, no seu posto de trabalho${p.cargo ? `, pensados para a rotina de <strong>${esc(p.cargo)}</strong>` : ''}.</p></div>
      <span class="pontos" style="font-size:1rem">${p.ja_pontuou_hoje ? 'Pontos de hoje já garantidos ✓' : `+${p.pontos} pt hoje`}</span>
    </div>
    <div class="layout-exercicio">
      <div class="pilha">
        <section class="card player">${htmlPlayer(p.duracao)}</section>
        <div class="motivo">Faça a pausa ativa no intervalo ou a cada 2 horas de trabalho repetitivo. Ela vale ${p.pontos} ponto por dia e não precisa de comprovante: basta seguir o treino até o fim.</div>
      </div>
      <div class="pilha">
        <section class="card"><div class="linha entre"><h2>Sequência</h2><span class="etiqueta">${p.feitas_semana} feita(s) nos últimos 7 dias</span></div>
          <ol class="passos" id="lista-passos">${p.passos.map((x, i) => {
            const mov = MOVIMENTOS[x.mov];
            const titulo = x.fase && x.fase !== fase ? `<li class="fase">${esc(x.fase)}</li>` : '';
            if (x.fase) fase = x.fase;
            return `${titulo}<li data-passo="${i}" tabindex="0" role="button"><svg class="mini" viewBox="0 25 200 165" data-mov="${x.mov}" aria-hidden="true"></svg>
              <div class="nome">${esc(mov.nome)}</div><span class="tempo">${duracaoTexto(x.tempo)}</span></li>`;
          }).join('')}</ol></section>
        <section class="aviso-cuidado"><h3>Cuidados</h3><ul class="lista-check"><li>Alongue até sentir uma tensão leve, nunca dor.</li><li>Se sentir formigamento ou dor que não passa nas mãos ou nos braços, procure o ambulatório ou o RH.</li></ul></section>
      </div>
    </div>`;
  $$('svg.mini').forEach((svg) => desenhar(svg, MOVIMENTOS[svg.dataset.mov], instanteTipico(MOVIMENTOS[svg.dataset.mov])));
  let pausaId = null;
  iniciarPlayer(sequencia, p.duracao, 1, {
    aoIniciar: async () => { pausaId = (await api('POST', '/api/pausa-ativa/iniciar')).id; },
    aoConcluir: async () => {
      if (!pausaId) throw new Error('Inicie a pausa pelo botão ▶ para registrá-la.');
      const r = await api('POST', `/api/pausa-ativa/${pausaId}/concluir`);
      pausaId = null;
      return r.pontos
        ? { html: `Pausa concluída! 🎉<br><span style="font-size:1rem;font-weight:500">+${r.pontos} ponto. Seu saldo: ${r.saldo} pts.</span>`, fala: `Pausa concluída! Você ganhou ${r.pontos} ponto.` }
        : { html: 'Pausa concluída! 🎉<br><span style="font-size:1rem;font-weight:500">Os pontos de hoje já foram garantidos. Continue se cuidando!</span>', fala: 'Pausa concluída! Muito bem.' };
    },
  });
}

// ====================== Recompensas (colaborador) ======================

const ICONE_TIPO = { folga: '🌴', vale_refeicao: '🍽️', voucher: '🎟️', produto: '🎁', outro: '⭐' };
const ROTULO_TIPO = { folga: 'Folga', vale_refeicao: 'Vale-refeição', voucher: 'Voucher', produto: 'Produto', outro: 'Outro' };
const STATUS_RESGATE = { solicitado: ['Aguardando RH', 'em_analise'], aprovado: ['Aprovado', 'aprovado'], entregue: ['Entregue', 'concluido'], cancelado: ['Cancelado', 'recusado'] };
const etiquetaResgate = (s) => `<span class="etiqueta ${STATUS_RESGATE[s][1]}">${STATUS_RESGATE[s][0]}</span>`;

async function telaRecompensas() {
  const { saldo, itens, resgates } = await api('GET', '/api/recompensas');
  app.innerHTML = `
    <div class="saudacao"><div><h1>Recompensas</h1><p class="suave">Troque seus pontos por benefícios. Depois do pedido, o RH confirma e combina a entrega.</p></div>
      <div class="saldo">Seu saldo<strong>${saldo} pts</strong></div></div>
    ${itens.length ? `<div class="grade cols-3">${itens.map((r) => {
      const falta = r.custo_pontos - saldo;
      const esgotado = r.estoque !== null && r.estoque <= 0;
      return `<article class="card recompensa">
        <div class="icone-recompensa" aria-hidden="true">${ICONE_TIPO[r.tipo] ?? '⭐'}</div>
        <div class="linha entre"><span class="etiqueta">${esc(ROTULO_TIPO[r.tipo] ?? r.tipo)}</span><span class="pontos">${r.custo_pontos} pts</span></div>
        <h2>${esc(r.titulo)}</h2>
        ${r.parceiro ? `<p class="ajuda">Parceiro: ${esc(r.parceiro)}</p>` : ''}
        <p class="pequeno">${esc(r.descricao ?? '')}</p>
        ${r.estoque !== null ? `<p class="ajuda">${esgotado ? 'Esgotado' : `${r.estoque} disponível(is)`}</p>` : ''}
        ${falta > 0 ? `<div class="barra" title="${saldo} de ${r.custo_pontos}"><span style="width:${Math.min(100, (saldo / r.custo_pontos) * 100)}%"></span></div>
          <p class="ajuda">Faltam ${falta} pontos</p>` : ''}
        <button data-resgatar="${r.id}" ${falta > 0 || esgotado ? 'disabled' : ''}>${esgotado ? 'Esgotado' : 'Resgatar'}</button>
      </article>`;
    }).join('')}</div>` : '<div class="card vazio">O RH ainda não cadastrou recompensas. Continue acumulando pontos!</div>'}
    <section class="card" style="margin-top:1.25rem"><h2>Meus resgates</h2>
      ${resgates.length ? `<div class="tabela"><table><thead><tr><th>Data</th><th>Recompensa</th><th class="num">Pontos</th><th>Situação</th><th>Código / observação</th></tr></thead>
        <tbody>${resgates.map((g) => `<tr><td>${dataBR(g.created_at)}</td><td>${esc(g.titulo)}${g.parceiro ? `<div class="ajuda">${esc(g.parceiro)}</div>` : ''}</td>
          <td class="num">${g.pontos}</td><td>${etiquetaResgate(g.status)}</td>
          <td class="pequeno">${g.codigo_voucher ? `<strong>${esc(g.codigo_voucher)}</strong> ` : ''}${esc(g.observacao ?? '')}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="vazio">Você ainda não resgatou nenhuma recompensa.</p>'}</section>`;
  $$('[data-resgatar]').forEach((b) => b.addEventListener('click', () => {
    const r = itens.find((x) => x.id === Number(b.dataset.resgatar));
    abrirDialogo(`<h2>Confirmar resgate</h2>
      <p>Trocar <strong>${r.custo_pontos} pontos</strong> por <strong>${esc(r.titulo)}</strong>?</p>
      <p class="suave pequeno">Seu saldo ficará em ${saldo - r.custo_pontos} pontos. Se o RH cancelar o pedido, os pontos voltam.</p>
      <div class="saida"></div>
      <div class="linha" style="justify-content:flex-end"><button class="secundario" data-fechar>Cancelar</button><button id="b-confirma">Confirmar resgate</button></div>`,
    (d) => $('#b-confirma', d).addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        await api('POST', `/api/recompensas/${r.id}/resgatar`);
        d.close();
        avisar('Resgate solicitado! Acompanhe em "Meus resgates".');
        telaRecompensas();
      } catch (err) { $('.saida', d).innerHTML = msg(err.message); e.target.disabled = false; }
    }));
  }));
}

// ====================== RH: recompensas ======================

async function telaRecompensasRH() {
  const aba = new URLSearchParams(location.hash.split('?')[1]).get('aba') ?? 'resgates';
  const abas = `<div class="abas">${[['resgates', 'Resgates'], ['catalogo', 'Catálogo'], ['parceiros', 'Parceiros']]
    .map(([k, t]) => `<button data-aba="${k}" class="${k === aba ? 'ativo' : ''}">${t}</button>`).join('')}</div>`;
  const ligarAbas = () => $$('[data-aba]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/rh/recompensas?aba=${b.dataset.aba}`; }));

  if (aba === 'resgates') {
    const lista = await api('GET', '/api/rh/resgates');
    const pendentes = lista.filter((g) => ['solicitado', 'aprovado'].includes(g.status));
    const linha = (g) => `<tr><td class="pequeno">${dataBR(g.created_at)}</td><td>${esc(g.nome)}<div class="ajuda">${esc(g.matricula)} · ${esc(g.loja ?? g.setor ?? '')}</div></td>
      <td>${esc(g.titulo)}${g.parceiro ? `<div class="ajuda">${esc(g.parceiro)}</div>` : ''}</td><td class="num">${g.pontos}</td><td>${etiquetaResgate(g.status)}</td>
      <td class="pequeno">${g.codigo_voucher ? `<strong>${esc(g.codigo_voucher)}</strong> ` : ''}${esc(g.observacao ?? '')}</td>
      <td style="white-space:nowrap">${g.status === 'solicitado' ? `<button class="pequeno" data-acao="aprovado" data-id="${g.id}">Aprovar</button> ` : ''}
        ${g.status === 'aprovado' ? `<button class="pequeno" data-acao="entregue" data-id="${g.id}">Marcar entregue</button> ` : ''}
        ${['solicitado', 'aprovado'].includes(g.status) ? `<button class="pequeno perigo" data-acao="cancelado" data-id="${g.id}">Cancelar</button>` : ''}</td></tr>`;
    const tabela = (itens, vazio) => (itens.length ? `<div class="tabela"><table><thead><tr><th>Data</th><th>Colaborador</th><th>Recompensa</th><th class="num">Pontos</th><th>Situação</th><th>Código / obs.</th><th></th></tr></thead>
      <tbody>${itens.map(linha).join('')}</tbody></table></div>` : `<p class="vazio">${vazio}</p>`);
    app.innerHTML = `<h1>Recompensas</h1>${abas}
      <section class="card" style="margin-bottom:1rem"><h2>Pendentes</h2>${tabela(pendentes, 'Nenhum resgate aguardando.')}</section>
      <section class="card"><h2>Histórico</h2>${tabela(lista.filter((g) => !pendentes.includes(g)), 'Nenhum resgate finalizado.')}</section>`;
    ligarAbas();
    $$('[data-acao]').forEach((b) => b.addEventListener('click', () => {
      const status = b.dataset.acao;
      const titulos = { aprovado: 'Aprovar resgate', entregue: 'Confirmar entrega', cancelado: 'Cancelar resgate' };
      abrirDialogo(`<h2>${titulos[status]}</h2>
        <form id="f-resgate"><div class="saida"></div>
          ${status !== 'cancelado' ? '<div class="campo"><label>Código do voucher (opcional)</label><input name="codigo_voucher" placeholder="Ex.: PIZZA-2026-001"></div>' : '<p class="suave pequeno">Os pontos voltam para o saldo do colaborador.</p>'}
          <div class="campo"><label>Observação para o colaborador ${status === 'cancelado' ? '(obrigatória)' : '(opcional)'}</label>
            <textarea name="observacao" ${status === 'cancelado' ? 'required' : ''} placeholder="${status === 'aprovado' ? 'Ex.: folga marcada para 15/11, combinada com o gerente.' : ''}"></textarea></div>
          <div class="linha" style="justify-content:flex-end"><button type="button" class="secundario" data-fechar>Voltar</button><button type="submit" class="${status === 'cancelado' ? 'perigo' : ''}">${titulos[status]}</button></div>
        </form>`, (d) => aoEnviar($('#f-resgate', d), async (f) => {
        await api('POST', `/api/rh/resgates/${b.dataset.id}/status`, { status, ...Object.fromEntries(f) });
        d.close();
        avisar('Resgate atualizado. O colaborador foi avisado.');
        telaRecompensasRH();
      }));
    }));
    return;
  }

  if (aba === 'catalogo') {
    const [{ tipos, itens }, parceiros] = await Promise.all([api('GET', '/api/rh/recompensas'), api('GET', '/api/rh/parceiros')]);
    app.innerHTML = `<div class="linha entre"><h1>Recompensas</h1><button id="b-nova">Nova recompensa</button></div>${abas}
      <div class="card"><div class="tabela"><table><thead><tr><th>Recompensa</th><th>Tipo</th><th>Parceiro</th><th class="num">Custo</th><th class="num">Estoque</th><th class="num">Resgates</th><th>Situação</th><th></th></tr></thead>
        <tbody>${itens.map((r) => `<tr><td>${ICONE_TIPO[r.tipo] ?? ''} ${esc(r.titulo)}<div class="ajuda">${esc(r.descricao ?? '')}</div></td><td>${esc(ROTULO_TIPO[r.tipo])}</td>
          <td>${esc(r.parceiro ?? 'Benefício interno')}</td><td class="num">${r.custo_pontos} pts</td><td class="num">${r.estoque ?? '∞'}</td><td class="num">${r.resgates}</td>
          <td>${r.ativo ? '<span class="etiqueta aprovado">ativa</span>' : '<span class="etiqueta">inativa</span>'}</td><td><button class="link pequeno" data-editar="${r.id}">editar</button></td></tr>`).join('')
          || '<tr><td colspan="8" class="vazio">Nenhuma recompensa cadastrada. Sugestões: dia de folga, vale-refeição, vale-pizza de um parceiro.</td></tr>'}</tbody></table></div></div>`;
    ligarAbas();
    const form = (r) => abrirDialogo(`<h2>${r ? 'Editar recompensa' : 'Nova recompensa'}</h2>
      <form id="f-rec"><div class="saida"></div>
        <div class="campos">
          <div class="campo"><label>Título</label><input name="titulo" required value="${esc(r?.titulo)}" placeholder="Ex.: Vale-pizza grande"></div>
          <div class="campo"><label>Tipo</label><select name="tipo">${tipos.map((t) => `<option value="${t}" ${r?.tipo === t ? 'selected' : ''}>${esc(ROTULO_TIPO[t])}</option>`).join('')}</select></div>
          <div class="campo"><label>Custo em pontos</label><input name="custo_pontos" type="number" min="1" step="1" required value="${esc(r?.custo_pontos)}"></div>
          <div class="campo"><label>Estoque <span class="ajuda">(vazio = ilimitado)</span></label><input name="estoque" type="number" min="0" step="1" value="${esc(r?.estoque)}"></div>
          <div class="campo"><label>Parceiro</label><select name="parceiro_id"><option value="">Benefício interno (sem parceiro)</option>
            ${parceiros.filter((x) => x.ativo || x.id === r?.parceiro_id).map((x) => `<option value="${x.id}" ${r?.parceiro_id === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>
        </div>
        <div class="campo"><label>Descrição e regras</label><textarea name="descricao" placeholder="Ex.: válido por 60 dias, de segunda a quinta.">${esc(r?.descricao)}</textarea></div>
        <div class="campo opcoes"><label><input type="checkbox" name="ativo" ${!r || r.ativo ? 'checked' : ''}> Disponível para resgate</label></div>
        <div class="linha" style="justify-content:flex-end"><button type="button" class="secundario" data-fechar>Cancelar</button><button type="submit">Salvar</button></div>
      </form>`, (d) => aoEnviar($('#f-rec', d), async (f) => {
      await api(r ? 'PUT' : 'POST', r ? `/api/rh/recompensas/${r.id}` : '/api/rh/recompensas', { ...Object.fromEntries(f), ativo: f.has('ativo') });
      d.close();
      telaRecompensasRH();
    }));
    $('#b-nova').addEventListener('click', () => form(null));
    $$('[data-editar]').forEach((b) => b.addEventListener('click', () => form(itens.find((x) => x.id === Number(b.dataset.editar)))));
    return;
  }

  const parceiros = await api('GET', '/api/rh/parceiros');
  app.innerHTML = `<div class="linha entre"><h1>Recompensas</h1><button id="b-novo">Novo parceiro</button></div>${abas}
    <div class="card"><div class="tabela"><table><thead><tr><th>Parceiro</th><th>Contato</th><th>Situação</th><th></th></tr></thead>
      <tbody>${parceiros.map((x) => `<tr><td>${esc(x.nome)}</td><td>${esc(x.contato ?? '—')}</td>
        <td>${x.ativo ? '<span class="etiqueta aprovado">ativo</span>' : '<span class="etiqueta">inativo</span>'}</td><td><button class="link pequeno" data-editar="${x.id}">editar</button></td></tr>`).join('')
        || '<tr><td colspan="4" class="vazio">Nenhum parceiro cadastrado.</td></tr>'}</tbody></table></div></div>`;
  ligarAbas();
  const form = (x) => abrirDialogo(`<h2>${x ? 'Editar parceiro' : 'Novo parceiro'}</h2>
    <form id="f-parc"><div class="saida"></div>
      <div class="campo"><label>Nome</label><input name="nome" required value="${esc(x?.nome)}"></div>
      <div class="campo"><label>Contato</label><input name="contato" value="${esc(x?.contato)}" placeholder="Telefone, e-mail ou responsável"></div>
      <div class="campo opcoes"><label><input type="checkbox" name="ativo" ${!x || x.ativo ? 'checked' : ''}> Parceiro ativo</label></div>
      <div class="linha" style="justify-content:flex-end"><button type="button" class="secundario" data-fechar>Cancelar</button><button type="submit">Salvar</button></div>
    </form>`, (d) => aoEnviar($('#f-parc', d), async (f) => {
    await api(x ? 'PUT' : 'POST', x ? `/api/rh/parceiros/${x.id}` : '/api/rh/parceiros', { ...Object.fromEntries(f), ativo: f.has('ativo') });
    d.close();
    telaRecompensasRH();
  }));
  $('#b-novo').addEventListener('click', () => form(null));
  $$('[data-editar]').forEach((b) => b.addEventListener('click', () => form(parceiros.find((p) => p.id === Number(b.dataset.editar)))));
}
