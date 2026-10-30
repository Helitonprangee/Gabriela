import { MODELOS, comoComprovar, appSugerido, intervaloDe } from './catalogo.js';
import { all, one, run, transaction } from '../db.js';
import { config } from '../config.js';
import { notificar } from './notificacoes.js';

export const NIVEIS_RISCO = ['nenhum', 'baixo', 'médio', 'alto'];
export const REGIOES = ['punhos', 'ombros', 'pescoco', 'coluna', 'pernas'];
export const RESTRICOES = ['impacto_articular', 'coluna', 'cardiaca', 'gestante'];
export const ATIVIDADES = ['caminhada', 'corrida', 'ciclismo', 'natacao', 'yoga', 'pilates', 'musculacao', 'danca'];

const normalizar = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lista = (csv) => new Set((csv ?? '').split(',').map((s) => s.trim()).filter(Boolean));

// Pistas nas descrições do cargo e das funções que complementam os riscos informados
// pelo RH. Por isso, quando o RH muda a descrição de um cargo, os próximos desafios mudam junto.
const PISTAS = [
  { re: /\bcaixa\b|registr|scanner|bipar|codigo de barras|digita|empacot|ensacar/, riscos: { movimentos_repetitivos: 2 }, regioes: ['punhos', 'ombros'] },
  { re: /fatiar|cortar|acougue|desoss|faca|frios/, riscos: { movimentos_repetitivos: 2 }, regioes: ['punhos'] },
  { re: /reposi|carreg|descarreg|estoque|palete|pallet|fardos|caixas pesadas|empilh/, riscos: { carrega_peso: 2 }, regioes: ['coluna', 'ombros'] },
  { re: /camara fria|congelad|frigorific|resfriad|refrigerad/, riscos: { ambiente_frio: 1 } },
  { re: /forno|padaria|cozinha|fritura|confeitaria|rotisseria/, riscos: { ambiente_calor: 1 } },
  { re: /em pe|balcao|circulando pela loja|corredores/, riscos: { horas_em_pe: 6 }, regioes: ['pernas'] },
  { re: /computador|escritorio|planilha|sistema|administrativ/, riscos: { horas_sentado: 6 }, regioes: ['pescoco'] },
  { re: /atendimento|atender|cliente|reclamac|sac\b/, riscos: { atendimento_publico: 2 } },
  { re: /noturn|madrugada/, riscos: { turno_noturno: 1 } },
];

export function inferirRiscosDoTexto(texto) {
  const t = normalizar(texto);
  const riscos = {};
  const regioes = new Set();
  for (const pista of PISTAS) {
    if (!pista.re.test(t)) continue;
    for (const [k, v] of Object.entries(pista.riscos)) riscos[k] = Math.max(riscos[k] ?? 0, v);
    pista.regioes?.forEach((r) => regioes.add(r));
  }
  return { riscos, regioes };
}

export function calcularIdade(dataNascimento, hoje = new Date()) {
  if (!dataNascimento) return null;
  const [a, m, d] = dataNascimento.split('-').map(Number);
  let idade = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) idade--;
  return idade;
}

/**
 * Junta tudo o que importa para personalizar desafios: dados do colaborador,
 * riscos informados pelo RH e riscos deduzidos das descrições do cargo e das funções.
 */
export function montarPerfil({ usuario, cargo, riscos, funcoes = [] }, hoje = new Date()) {
  const base = {
    movimentos_repetitivos: 0, horas_em_pe: 0, horas_sentado: 0, carrega_peso: 0,
    ambiente_frio: 0, ambiente_calor: 0, turno_noturno: 0, atendimento_publico: 0,
    ...(riscos ?? {}),
  };
  const texto = [cargo?.nome, cargo?.descricao, ...funcoes.map((f) => `${f.nome} ${f.descricao ?? ''}`)].join(' ');
  const inferido = inferirRiscosDoTexto(texto);
  for (const [k, v] of Object.entries(inferido.riscos)) base[k] = Math.max(Number(base[k]) || 0, v);

  const regioes = lista(riscos?.regioes_sobrecarga);
  inferido.regioes.forEach((r) => regioes.add(r));

  const imc = usuario.altura_cm && usuario.peso_kg
    ? Math.round((usuario.peso_kg / (usuario.altura_cm / 100) ** 2) * 10) / 10
    : null;

  return {
    idade: calcularIdade(usuario.data_nascimento, hoje),
    sexo: usuario.sexo,
    nivel: usuario.nivel_atividade,
    imc,
    restricoes: lista(usuario.restricoes),
    preferidas: lista(usuario.atividades_preferidas),
    riscos: base,
    regioes,
  };
}

/**
 * Escolhe os modelos mais adequados ao perfil.
 * historico: [{ modelo_codigo, status, created_at, concluido_em }] dos desafios do colaborador.
 * Não repete modelos ativos nem modelos cumpridos dentro do intervalo do modelo, e evita
 * dois desafios do mesmo grupo (ex.: dois aeróbicos intensos) ao mesmo tempo.
 */
export function selecionarModelos(perfil, { categoria, quantidade, historico = [], hoje = new Date(), aleatorio = Math.random }) {
  if (quantidade <= 0) return [];
  const ativos = historico.filter((d) => ['ativo', 'em_analise'].includes(d.status));
  const codigosAtivos = new Set(ativos.map((d) => d.modelo_codigo));
  const gruposAtivos = new Set(ativos.map((d) => MODELOS.find((m) => m.codigo === d.modelo_codigo)?.grupo).filter(Boolean));

  const emCarencia = (modelo) => historico.some((d) => {
    if (d.modelo_codigo !== modelo.codigo || d.status !== 'concluido') return false;
    const dias = (hoje - new Date(d.concluido_em ?? d.created_at)) / 86_400_000;
    return dias < intervaloDe(modelo, perfil);
  });

  const candidatos = MODELOS
    .filter((m) => m.categoria === categoria && !codigosAtivos.has(m.codigo) && m.elegivel(perfil) && !emCarencia(m))
    .map((m) => ({ modelo: m, nota: m.peso(perfil) + aleatorio() * 1.5 }))
    .sort((a, b) => b.nota - a.nota);

  const escolhidos = [];
  for (const { modelo } of candidatos) {
    if (escolhidos.length >= quantidade) break;
    if (modelo.grupo && (gruposAtivos.has(modelo.grupo) || escolhidos.some((e) => e.grupo === modelo.grupo))) continue;
    escolhidos.push(modelo);
  }
  return escolhidos;
}

const somarDias = (data, dias) => {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** Pontos definidos pelo sistema: valor base do modelo + bônus quando ataca um risco alto do cargo. */
export function calcularPontos(modelo, perfil) {
  const r = perfil.riscos;
  const riscoAlto = (modelo.grupo === 'ergonomico_superior' && r.movimentos_repetitivos >= 3)
    || (modelo.grupo === 'ergonomico_inferior' && r.horas_em_pe >= 8)
    || (modelo.grupo === 'ergonomico_coluna' && r.carrega_peso >= 3);
  return modelo.pontos + (riscoAlto ? 2 : 0);
}

export function instanciarDesafio(modelo, perfil, { nome, hoje = new Date() }) {
  const motivos = modelo.motivos(perfil).filter(Boolean);
  const inicio = modelo.categoria === 'saude_preventiva' ? somarDias(hoje, -30) : hoje.toISOString().slice(0, 10);
  const prazo = somarDias(hoje, modelo.prazoDias);
  const criterios = modelo.categoria === 'atividade_fisica'
    ? { tipo: 'atividade', atividades_aceitas: modelo.atividade.aceitas, duracao_minima_min: modelo.atividade.duracaoMin }
    : { tipo: 'exame', exames_aceitos: modelo.exame.aceitos };
  Object.assign(criterios, { nome_colaborador: nome, data_inicio: inicio, data_fim: prazo });

  return {
    modelo_codigo: modelo.codigo,
    categoria: modelo.categoria,
    titulo: modelo.titulo,
    descricao: modelo.descricao,
    motivo: motivos.length ? `Escolhido para você porque ${motivos.join('; ')}.` : 'Escolhido para manter você ativo e saudável.',
    como_comprovar: comoComprovar(modelo),
    app_sugerido: appSugerido(modelo),
    criterios,
    pontos: calcularPontos(modelo, perfil),
    prazo,
  };
}

// ---------------- Persistência ----------------

export function carregarContexto(usuarioId) {
  const usuario = one('SELECT * FROM usuarios WHERE id = ?', usuarioId);
  if (!usuario) return null;
  const cargo = usuario.cargo_id ? one('SELECT * FROM cargos WHERE id = ?', usuario.cargo_id) : null;
  const riscos = cargo ? one('SELECT * FROM cargo_riscos WHERE cargo_id = ?', cargo.id) : null;
  const funcoes = cargo ? all('SELECT * FROM funcoes WHERE cargo_id = ?', cargo.id) : [];
  return { usuario, cargo, riscos, funcoes };
}

/** Marca como expirados os desafios ativos com prazo vencido. */
export function expirarVencidos(usuarioId, hoje = new Date()) {
  run(`UPDATE desafios SET status = 'expirado' WHERE usuario_id = ? AND status = 'ativo' AND prazo < ?`,
    usuarioId, hoje.toISOString().slice(0, 10));
}

/** Completa os desafios ativos do colaborador até a quantidade configurada por categoria. */
export function gerarDesafios(usuarioId, { hoje = new Date(), aleatorio = Math.random } = {}) {
  const ctx = carregarContexto(usuarioId);
  if (!ctx || ctx.usuario.papel !== 'colaborador' || !ctx.usuario.ativo) return [];
  expirarVencidos(usuarioId, hoje);

  const perfil = montarPerfil(ctx, hoje);
  const historico = all('SELECT modelo_codigo, categoria, status, created_at, concluido_em FROM desafios WHERE usuario_id = ?', usuarioId);
  const criados = [];

  transaction(() => {
    for (const [categoria, alvo] of Object.entries(config.desafiosAtivos)) {
      const ativos = historico.filter((d) => d.categoria === categoria && ['ativo', 'em_analise'].includes(d.status)).length;
      const modelos = selecionarModelos(perfil, { categoria, quantidade: alvo - ativos, historico, hoje, aleatorio });
      for (const modelo of modelos) {
        const d = instanciarDesafio(modelo, perfil, { nome: ctx.usuario.nome, hoje });
        const { lastInsertRowid } = run(
          `INSERT INTO desafios (usuario_id, modelo_codigo, categoria, titulo, descricao, motivo, como_comprovar,
             app_sugerido, criterios, pontos, prazo, cargo_id, cargo_versao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          usuarioId, d.modelo_codigo, d.categoria, d.titulo, d.descricao, d.motivo, d.como_comprovar,
          d.app_sugerido, JSON.stringify(d.criterios), d.pontos, d.prazo, ctx.cargo?.id ?? null, ctx.cargo?.versao ?? null,
        );
        historico.push({ modelo_codigo: d.modelo_codigo, categoria, status: 'ativo', created_at: hoje.toISOString() });
        criados.push({ id: Number(lastInsertRowid), ...d });
      }
    }
  });
  for (const d of criados) {
    notificar(usuarioId, {
      tipo: 'novo_desafio', referenciaId: d.id, titulo: 'Novo desafio para você',
      mensagem: `${d.titulo} (+${d.pontos} pontos, até ${d.prazo.split('-').reverse().join('/')}).`, link: `#/desafio/${d.id}`,
    }).catch(() => {});
  }
  return criados;
}
