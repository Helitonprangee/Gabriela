import { all } from '../db.js';

/** Primeiro e último dia (exclusivo) do mês AAAA-MM. */
export function periodoDoMes(mes) {
  const hoje = new Date();
  const m = /^\d{4}-\d{2}$/.test(mes ?? '') ? mes : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const [a, n] = m.split('-').map(Number);
  const fim = n === 12 ? `${a + 1}-01-01` : `${a}-${String(n + 1).padStart(2, '0')}-01`;
  return { mes: m, inicio: `${m}-01`, fim };
}

/**
 * Ranking do mês por loja e por setor. Para ser justo com equipes de tamanhos diferentes,
 * a classificação usa a média de pontos por colaborador (desafios e pausas ativas).
 */
export function ranking(mes) {
  const p = periodoDoMes(mes);
  const porColaborador = all(
    `SELECT u.id, u.loja_id, l.nome AS loja, u.setor_id, s.nome AS setor,
       COALESCE((SELECT SUM(k.pontos) FROM pontos_lancamentos k WHERE k.usuario_id = u.id
                 AND k.origem IN ('desafio','pausa_ativa') AND k.created_at >= ? AND k.created_at < ?), 0) AS pontos,
       (SELECT COUNT(*) FROM desafios d WHERE d.usuario_id = u.id AND d.status = 'concluido'
                 AND d.concluido_em >= ? AND d.concluido_em < ?) AS desafios
     FROM usuarios u LEFT JOIN lojas l ON l.id = u.loja_id LEFT JOIN setores s ON s.id = u.setor_id
     WHERE u.papel = 'colaborador' AND u.ativo = 1`,
    p.inicio, p.fim, p.inicio, p.fim,
  );
  const agrupar = (chave, nome) => {
    const grupos = new Map();
    for (const c of porColaborador) {
      if (c[chave] == null) continue;
      const g = grupos.get(c[chave]) ?? { id: c[chave], nome: c[nome], colaboradores: 0, participantes: 0, pontos: 0, desafios: 0 };
      g.colaboradores++;
      if (c.pontos > 0) g.participantes++;
      g.pontos += c.pontos;
      g.desafios += c.desafios;
      grupos.set(c[chave], g);
    }
    return [...grupos.values()]
      .map((g) => ({ ...g, media: Math.round((g.pontos / g.colaboradores) * 10) / 10, participacao: Math.round((g.participantes / g.colaboradores) * 100) }))
      .sort((a, b) => b.media - a.media || b.participacao - a.participacao || a.nome.localeCompare(b.nome))
      .map((g, i) => ({ ...g, posicao: i + 1 }));
  };
  return { ...p, lojas: agrupar('loja_id', 'loja'), setores: agrupar('setor_id', 'setor') };
}
