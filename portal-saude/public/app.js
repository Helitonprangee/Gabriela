// Portal Viva Bem: SPA sem dependências. Todo HTML dinâmico passa por esc().

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
  colaborador: [['#/inicio', 'Meus desafios'], ['#/pontos', 'Meus pontos'], ['#/concluidos', 'Concluídos'], ['#/perfil', 'Meu perfil'], ['#/recompensas', 'Recompensas', true]],
  rh: [['#/rh/painel', 'Painel'], ['#/rh/colaboradores', 'Colaboradores'], ['#/rh/estrutura', 'Setores e cargos'], ['#/rh/comprovantes', 'Comprovantes']],
};

const ROTAS = {
  '#/login': telaLogin,
  '#/trocar-senha': telaTrocarSenha,
  '#/inicio': telaInicio,
  '#/pontos': telaPontos,
  '#/concluidos': telaConcluidos,
  '#/perfil': telaPerfil,
  '#/recompensas': telaRecompensas,
  '#/rh/painel': telaPainelRH,
  '#/rh/colaboradores': telaColaboradores,
  '#/rh/estrutura': telaEstrutura,
  '#/rh/comprovantes': telaComprovantes,
};

async function navegar() {
  clearTimeout(temporizador);
  if (!sessao) {
    try { sessao = (await api('GET', '/api/auth/sessao')).usuario; } catch { sessao = null; }
  }
  let rota = location.hash.split('?')[0] || '#/';
  if (!sessao) rota = '#/login';
  else if (sessao.deve_trocar_senha) rota = '#/trocar-senha';
  else if (!ROTAS[rota] || rota === '#/login' || rota === '#/trocar-senha'
    || (rota.startsWith('#/rh') !== (sessao.papel === 'rh'))) rota = sessao.papel === 'rh' ? '#/rh/painel' : '#/inicio';
  if (location.hash.split('?')[0] !== rota) { location.hash = rota; return; }

  const logado = sessao && !sessao.deve_trocar_senha;
  $('#topo').hidden = !logado;
  if (logado) {
    $('#nome-usuario').textContent = sessao.nome;
    $('#menu').innerHTML = MENU[sessao.papel].map(([href, texto, fase2]) =>
      `<a href="${href}" class="${rota === href ? 'ativo' : ''}">${esc(texto)}${fase2 && !sessao.recursos?.recompensas ? '<span class="em-breve">em breve</span>' : ''}</a>`).join('');
  }
  app.innerHTML = '<p class="suave">Carregando…</p>';
  try { await ROTAS[rota](); }
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
    ${podeEnviar ? `
    <form class="f-comprovante" data-id="${d.id}">
      <div class="saida"></div>
      <label for="arq-${d.id}">${ultimo?.status === 'recusado' ? 'Enviar novo comprovante' : 'Enviar comprovante'}</label>
      <div class="linha">
        <input id="arq-${d.id}" type="file" name="arquivo" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" required style="flex:1">
        <button type="submit">Enviar</button>
      </div>
      <span class="ajuda">Print (JPG, PNG) ou PDF de até 10 MB.</span>
    </form>` : ''}
  </article>`;
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

  $$('.f-comprovante').forEach((form) => aoEnviar(form, async (f) => {
    await api('POST', `/api/desafios/${form.dataset.id}/comprovantes`, f);
    avisar('Comprovante enviado! A validação leva alguns instantes.');
    await telaInicio();
  }));
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
          <dt>Setor</dt><dd>${esc(u.setor ?? '—')}</dd><dt>Cargo</dt><dd>${esc(u.cargo ?? '—')}</dd>
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
        <button type="submit">Salvar perfil</button>
      </form>
    </div>`;
  aoEnviar($('#f-perfil'), async (f) => {
    const dados = Object.fromEntries(['email', 'telefone', 'altura_cm', 'peso_kg', 'nivel_atividade', 'observacoes_saude'].map((k) => [k, f.get(k)]));
    dados.atividades_preferidas = f.getAll('atividades_preferidas');
    dados.restricoes = f.getAll('restricoes');
    await api('PUT', '/api/perfil', dados);
    avisar('Perfil atualizado. Os próximos desafios vão considerar essas informações.');
  });
  aoEnviar($('#f-senha'), async (f) => {
    await api('POST', '/api/auth/trocar-senha', { senha_atual: f.get('atual'), nova_senha: f.get('nova') });
    $('#f-senha').reset();
    avisar('Senha alterada.');
  });
}

async function telaRecompensas() {
  if (!sessao.recursos?.recompensas) {
    app.innerHTML = `<div class="card vazio"><h1>Recompensas</h1>
      <p>Em breve você poderá trocar seus pontos por folgas, vale-refeição, vale-pizza e outros benefícios de parceiros.</p>
      <p>Continue acumulando pontos!</p></div>`;
    return;
  }
  const lista = await api('GET', '/api/recompensas');
  app.innerHTML = `<h1>Recompensas</h1><div class="grade cols-3">${lista.map((r) => `
    <div class="card"><h3>${esc(r.titulo)}</h3><p class="suave">${esc(r.descricao)}</p><span class="pontos">${r.custo_pontos} pts</span></div>`).join('') || '<p class="vazio">Nenhuma recompensa cadastrada.</p>'}</div>`;
}

// ====================== RH: painel ======================

async function telaPainelRH() {
  const dias = new URLSearchParams(location.hash.split('?')[1]).get('dias') ?? '30';
  const p = await api('GET', `/api/rh/painel?dias=${dias}`);
  const t = p.totais;
  const barra = (pct) => `<div class="barra" title="${pct}%"><span style="width:${pct}%"></span></div>`;
  const catConcluidos = Object.fromEntries(p.porCategoria.map((c) => [c.categoria, c.concluidos]));
  app.innerHTML = `
    <div class="linha entre" style="margin-bottom:1rem">
      <h1>Painel de engajamento</h1>
      <label class="linha" style="font-weight:400">Período
        <select id="periodo" style="width:auto">${[7, 30, 90, 365].map((d) => `<option value="${d}" ${String(d) === dias ? 'selected' : ''}>Últimos ${d} dias</option>`).join('')}</select>
      </label>
    </div>
    ${p.ia_habilitada ? '' : msg('A validação automática por IA está desligada (defina ANTHROPIC_API_KEY). Os comprovantes ficam aguardando revisão manual na aba Comprovantes.', 'alerta')}
    ${t.em_analise ? msg(`${t.em_analise} comprovante(s) aguardando análise.`, 'alerta') : ''}
    <div class="grade kpis">
      <div class="card kpi"><div class="valor">${t.engajamento}%</div><div class="rotulo">Engajamento (${t.engajados} de ${t.colaboradores})</div></div>
      <div class="card kpi"><div class="valor">${t.concluidos}</div><div class="rotulo">Desafios cumpridos</div></div>
      <div class="card kpi"><div class="valor">${catConcluidos.atividade_fisica ?? 0}</div><div class="rotulo">Atividades físicas</div></div>
      <div class="card kpi"><div class="valor">${catConcluidos.saude_preventiva ?? 0}</div><div class="rotulo">Exames/consultas preventivas</div></div>
      <div class="card kpi"><div class="valor">${t.recusados}</div><div class="rotulo">Comprovantes recusados</div></div>
      <div class="card kpi"><div class="valor">${t.pontos}</div><div class="rotulo">Pontos distribuídos</div></div>
    </div>
    <p class="ajuda" style="margin:.5rem 0 1.25rem">Engajado = enviou pelo menos um comprovante no período.</p>

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

  $('#periodo').addEventListener('change', (e) => { location.hash = `#/rh/painel?dias=${e.target.value}`; });
  $('#filtro-colab').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('#t-colab tbody tr').forEach((tr) => { tr.hidden = !tr.dataset.busca.includes(q); });
  });
  $$('[data-ver]').forEach((b) => b.addEventListener('click', () => verComprovante(b.dataset.ver, telaPainelRH)));
}

// ====================== RH: colaboradores ======================

async function carregarEstrutura() {
  const [setores, { cargos }] = await Promise.all([api('GET', '/api/rh/setores'), api('GET', '/api/rh/cargos')]);
  return { setores, cargos };
}

async function telaColaboradores() {
  const [lista, { setores, cargos }] = await Promise.all([api('GET', '/api/rh/colaboradores'), carregarEstrutura()]);
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
      <div class="tabela"><table id="t-lista"><thead><tr><th>Nome</th><th>Matrícula</th><th>Nascimento</th><th>Sexo</th><th>Setor / cargo</th><th class="num">Saldo</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.map((c) => `<tr data-busca="${esc(`${c.nome} ${c.matricula} ${c.setor} ${c.cargo}`.toLowerCase())}">
        <td>${esc(c.nome)}</td><td>${esc(c.matricula)}</td><td>${dataBR(c.data_nascimento)}</td><td>${esc(c.sexo)}</td>
        <td>${esc(c.setor ?? '—')}<div class="ajuda">${esc(c.cargo ?? '')}</div></td><td class="num">${c.saldo}</td>
        <td>${c.ativo ? (c.deve_trocar_senha ? '<span class="etiqueta em_analise">aguardando 1º acesso</span>' : '<span class="etiqueta aprovado">ativo</span>') : '<span class="etiqueta">inativo</span>'}</td>
        <td><button class="link pequeno" data-editar="${c.id}">editar</button></td></tr>`).join('') || '<tr><td colspan="8" class="vazio">Nenhum colaborador cadastrado.</td></tr>'}</tbody></table></div>
    </div>`;

  $('#busca').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('#t-lista tbody tr[data-busca]').forEach((tr) => { tr.hidden = !tr.dataset.busca.includes(q); });
  });
  $('#b-novo').addEventListener('click', () => formColaborador(null, setores, cargos));
  $('#b-importar').addEventListener('click', () => dialogoImportacao());
  $('#b-gerar').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const r = await api('POST', '/api/rh/desafios/gerar'); avisar(`${r.desafios_criados} desafio(s) criados para ${r.colaboradores} colaborador(es).`); }
    catch (err) { avisar(err.message); } finally { e.target.disabled = false; }
  });
  $$('[data-editar]').forEach((b) => b.addEventListener('click', () => formColaborador(lista.find((c) => c.id === Number(b.dataset.editar)), setores, cargos)));
}

function formColaborador(c, setores, cargos) {
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
      Setor e cargo devem estar cadastrados. <a href="/api/rh/importacao/modelo">Baixar modelo</a>.</p>
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
  const { setores, cargos } = await carregarEstrutura();
  const nivel = (n) => NIVEIS[n] ?? '—';
  app.innerHTML = `
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
  $$('[data-ed-setor]').forEach((b) => b.addEventListener('click', () => formSetor(setores.find((s) => s.id === Number(b.dataset.edSetor)))));
  $$('[data-del-setor]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Excluir este setor?')) return;
    try { await api('DELETE', `/api/rh/setores/${b.dataset.delSetor}`); telaEstrutura(); } catch (err) { avisar(err.message); }
  }));
  $$('[data-novo-cargo]').forEach((b) => b.addEventListener('click', () => formCargo(null, Number(b.dataset.novoCargo))));
  $$('[data-ed-cargo]').forEach((b) => b.addEventListener('click', () => formCargo(cargos.find((c) => c.id === Number(b.dataset.edCargo)))));
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
