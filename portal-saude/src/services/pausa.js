import { one, run, transaction } from '../db.js';
import { config } from '../config.js';
import { carregarContexto, montarPerfil } from './desafios.js';

const DURACAO_MAXIMA = 300; // 5 minutos

/**
 * Monta uma pausa ativa curta (3 a 5 min), feita em pé no próprio posto de trabalho,
 * com os alongamentos que combatem os riscos do cargo.
 */
export function montarPausa(perfil) {
  const r = perfil.riscos;
  const reg = perfil.regioes;
  const blocos = [];
  if (r.movimentos_repetitivos >= 1 || reg.has('punhos')) blocos.push(['extensao_punho', 40], ['flexao_punho', 40]);
  if (r.movimentos_repetitivos >= 1 || reg.has('ombros')) blocos.push(['circulos_bracos', 30]);
  if (reg.has('pescoco') || r.horas_sentado >= 4 || r.atendimento_publico >= 2) blocos.push(['flexao_pescoco', 40]);
  if (r.carrega_peso >= 1 || reg.has('coluna')) blocos.push(['extensao_lombar', 30]);
  if (r.horas_em_pe >= 4 || reg.has('pernas')) blocos.push(['panturrilha', 40], ['alongamento_quadriceps', 40]);
  if (r.horas_sentado >= 4) blocos.push(['marcha', 40]);
  if (blocos.length < 3) blocos.push(['circulos_bracos', 30], ['flexao_pescoco', 40], ['panturrilha', 40]);

  const vistos = new Set();
  const passos = [{ mov: 'respiracao', tempo: 30, fase: 'Respire' }];
  let total = 30 + 30; // respiração no início e no fim
  for (const [mov, tempo] of blocos) {
    if (vistos.has(mov) || total + tempo > DURACAO_MAXIMA) continue;
    vistos.add(mov);
    passos.push({ mov, tempo, fase: passos.length === 1 ? 'Alongue' : undefined });
    total += tempo;
  }
  passos.push({ mov: 'respiracao', tempo: 30, fase: 'Finalize' });
  return { passos, duracao: total };
}

const jaPontuouHoje = (usuarioId) => Boolean(one(
  `SELECT 1 FROM pontos_lancamentos WHERE usuario_id = ? AND origem = 'pausa_ativa'
   AND date(created_at, 'localtime') = date('now', 'localtime')`,
  usuarioId,
));

export function pausaDoColaborador(usuarioId) {
  const ctx = carregarContexto(usuarioId);
  const pausa = montarPausa(montarPerfil(ctx));
  const feitasSemana = one(
    `SELECT COUNT(*) AS n FROM pausas_ativas WHERE usuario_id = ? AND concluida_em IS NOT NULL AND iniciada_em >= datetime('now', '-7 days')`,
    usuarioId,
  ).n;
  return { ...pausa, pontos: config.pausaAtiva.pontos, ja_pontuou_hoje: jaPontuouHoje(usuarioId), feitas_semana: feitasSemana, cargo: ctx.cargo?.nome ?? null };
}

export function iniciarPausa(usuarioId) {
  const { duracao } = montarPausa(montarPerfil(carregarContexto(usuarioId)));
  return Number(run('INSERT INTO pausas_ativas (usuario_id, duracao_seg) VALUES (?, ?)', usuarioId, duracao).lastInsertRowid);
}

/**
 * Conclui a pausa. Só pontua se ela durou pelo menos 80% do tempo previsto
 * e no máximo uma vez por dia.
 */
export function concluirPausa(usuarioId, pausaId, agora = new Date()) {
  return transaction(() => {
    const p = one('SELECT * FROM pausas_ativas WHERE id = ? AND usuario_id = ?', pausaId, usuarioId);
    if (!p) return { erro: 'Pausa não encontrada.' };
    if (p.concluida_em) return { erro: 'Esta pausa já foi registrada.' };
    const decorrido = (agora - new Date(`${p.iniciada_em.replace(' ', 'T')}Z`)) / 1000;
    if (decorrido < p.duracao_seg * 0.8) return { erro: 'Complete a pausa ativa até o fim para registrá-la.' };
    run(`UPDATE pausas_ativas SET concluida_em = datetime('now') WHERE id = ?`, p.id);
    if (config.pausaAtiva.pontos <= 0 || jaPontuouHoje(usuarioId)) return { pontos: 0 };
    run(`INSERT INTO pontos_lancamentos (usuario_id, pontos, origem, referencia_id, descricao) VALUES (?, ?, 'pausa_ativa', ?, 'Pausa ativa concluída')`,
      usuarioId, config.pausaAtiva.pontos, p.id);
    return { pontos: config.pausaAtiva.pontos };
  });
}
