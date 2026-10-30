import { all, one, run } from '../db.js';

export function saldo(usuarioId) {
  return one('SELECT COALESCE(SUM(pontos), 0) AS saldo FROM pontos_lancamentos WHERE usuario_id = ?', usuarioId).saldo;
}

export function extrato(usuarioId) {
  return all('SELECT * FROM pontos_lancamentos WHERE usuario_id = ? ORDER BY created_at DESC, id DESC', usuarioId);
}

/**
 * Credita os pontos de um desafio concluído. A restrição UNIQUE(origem, referencia_id)
 * garante que o mesmo desafio nunca pontua duas vezes.
 */
export function creditarDesafio(desafio) {
  run(
    `INSERT OR IGNORE INTO pontos_lancamentos (usuario_id, pontos, origem, referencia_id, descricao)
     VALUES (?, ?, 'desafio', ?, ?)`,
    desafio.usuario_id, desafio.pontos, desafio.id, `Desafio concluído: ${desafio.titulo}`,
  );
}

// Fase 2: a troca por recompensas vai lançar um débito (pontos negativos, origem 'resgate')
// referenciando resgates.id, depois de conferir saldo(usuarioId) >= custo da recompensa.
