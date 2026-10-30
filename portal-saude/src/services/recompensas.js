import { all, one, run, transaction } from '../db.js';
import { saldo } from './pontos.js';
import { notificar } from './notificacoes.js';

export const TIPOS_RECOMPENSA = ['folga', 'vale_refeicao', 'voucher', 'produto', 'outro'];

export class ErroResgate extends Error {}

export function catalogo() {
  return all(
    `SELECT r.*, p.nome AS parceiro FROM recompensas r LEFT JOIN parceiros p ON p.id = r.parceiro_id
     WHERE r.ativo = 1 AND (p.id IS NULL OR p.ativo = 1) ORDER BY r.custo_pontos`,
  );
}

/** Troca pontos por uma recompensa: confere saldo e estoque, debita os pontos e reserva o item. */
export function resgatar(usuarioId, recompensaId) {
  const resgate = transaction(() => {
    const r = one(
      `SELECT r.* FROM recompensas r LEFT JOIN parceiros p ON p.id = r.parceiro_id
       WHERE r.id = ? AND r.ativo = 1 AND (p.id IS NULL OR p.ativo = 1)`,
      recompensaId,
    );
    if (!r) throw new ErroResgate('Recompensa indisponível.');
    if (r.estoque !== null && r.estoque <= 0) throw new ErroResgate('Esta recompensa esgotou.');
    const disponivel = saldo(usuarioId);
    if (disponivel < r.custo_pontos) throw new ErroResgate(`Saldo insuficiente: você tem ${disponivel} pontos e esta recompensa custa ${r.custo_pontos}.`);

    const id = Number(run(
      'INSERT INTO resgates (usuario_id, recompensa_id, pontos) VALUES (?, ?, ?)', usuarioId, r.id, r.custo_pontos,
    ).lastInsertRowid);
    run(`INSERT INTO pontos_lancamentos (usuario_id, pontos, origem, referencia_id, descricao) VALUES (?, ?, 'resgate', ?, ?)`,
      usuarioId, -r.custo_pontos, id, `Resgate: ${r.titulo}`);
    if (r.estoque !== null) run('UPDATE recompensas SET estoque = estoque - 1 WHERE id = ?', r.id);
    return { id, titulo: r.titulo, pontos: r.custo_pontos };
  });
  return resgate;
}

const TRANSICOES = { solicitado: ['aprovado', 'cancelado'], aprovado: ['entregue', 'cancelado'], entregue: [], cancelado: [] };
const MENSAGENS = {
  aprovado: (t) => `Seu resgate de "${t}" foi aprovado. O RH vai combinar a entrega com você.`,
  entregue: (t) => `Seu resgate de "${t}" foi entregue. Aproveite!`,
  cancelado: (t) => `Seu resgate de "${t}" foi cancelado e os pontos voltaram para o seu saldo.`,
};

/** O RH aprova, entrega ou cancela um resgate. Cancelar devolve os pontos e o estoque. */
export async function atualizarResgate(id, novoStatus, { codigoVoucher = null, observacao = null } = {}) {
  const r = transaction(() => {
    const atual = one('SELECT g.*, r.titulo, r.estoque FROM resgates g JOIN recompensas r ON r.id = g.recompensa_id WHERE g.id = ?', id);
    if (!atual) throw new ErroResgate('Resgate não encontrado.');
    if (!TRANSICOES[atual.status].includes(novoStatus)) {
      throw new ErroResgate(`Não é possível passar de "${atual.status}" para "${novoStatus}".`);
    }
    run(`UPDATE resgates SET status = ?, codigo_voucher = COALESCE(?, codigo_voucher), observacao = COALESCE(?, observacao),
           atualizado_em = datetime('now') WHERE id = ?`, novoStatus, codigoVoucher, observacao, id);
    if (novoStatus === 'cancelado') {
      run(`INSERT INTO pontos_lancamentos (usuario_id, pontos, origem, referencia_id, descricao) VALUES (?, ?, 'estorno', ?, ?)`,
        atual.usuario_id, atual.pontos, id, `Estorno do resgate: ${atual.titulo}`);
      if (atual.estoque !== null) run('UPDATE recompensas SET estoque = estoque + 1 WHERE id = ?', atual.recompensa_id);
    }
    return atual;
  });
  await notificar(r.usuario_id, {
    tipo: `resgate_${novoStatus}`, referenciaId: id, titulo: `Resgate ${novoStatus}`,
    mensagem: `${MENSAGENS[novoStatus](r.titulo)}${codigoVoucher ? ` Código: ${codigoVoucher}.` : ''}${observacao ? ` ${observacao}` : ''}`,
    link: '#/recompensas',
  }, { externo: true });
}

export function resgatesDoUsuario(usuarioId) {
  return all(
    `SELECT g.id, g.status, g.pontos, g.codigo_voucher, g.observacao, g.created_at, g.atualizado_em, r.titulo, r.tipo, p.nome AS parceiro
     FROM resgates g JOIN recompensas r ON r.id = g.recompensa_id LEFT JOIN parceiros p ON p.id = r.parceiro_id
     WHERE g.usuario_id = ? ORDER BY g.id DESC`,
    usuarioId,
  );
}
