import { Router } from 'express';
import multer from 'multer';
import { all, one, run, transaction } from '../db.js';
import { hashSenha } from '../auth.js';
import { config } from '../config.js';
import { NIVEIS_RISCO, REGIOES, gerarDesafios } from '../services/desafios.js';
import { COLUNAS, converterData, converterSexo, lerPlanilha, validarLinhas } from '../services/importacao.js';
import { registrarResultado, validarComprovante } from '../services/validacao.js';
import { MODELOS } from '../services/catalogo.js';
import { converterVideo, listarVideos } from '../services/videos.js';
import { ErroResgate, TIPOS_RECOMPENSA, atualizarResgate } from '../services/recompensas.js';
import { canaisConfigurados, executarLembretes } from '../services/notificacoes.js';
import { ranking } from '../services/ranking.js';

export const rotasRH = Router();
const uploadPlanilha = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

const texto = (v) => String(v ?? '').trim();
const erro = (res, msg, status = 400) => res.status(status).json({ erro: msg });

// ---------------- Setores ----------------

rotasRH.get('/setores', (_req, res) => {
  res.json(all(
    `SELECT s.*, (SELECT COUNT(*) FROM usuarios u WHERE u.setor_id = s.id AND u.ativo = 1) AS colaboradores
     FROM setores s ORDER BY s.nome`,
  ));
});

rotasRH.post('/setores', (req, res) => {
  const nome = texto(req.body?.nome);
  if (!nome) return erro(res, 'Informe o nome do setor.');
  if (one('SELECT 1 FROM setores WHERE nome = ?', nome)) return erro(res, 'Já existe um setor com esse nome.');
  const { lastInsertRowid } = run('INSERT INTO setores (nome, descricao) VALUES (?, ?)', nome, texto(req.body?.descricao) || null);
  res.status(201).json(one('SELECT * FROM setores WHERE id = ?', lastInsertRowid));
});

rotasRH.put('/setores/:id', (req, res) => {
  const nome = texto(req.body?.nome);
  if (!nome) return erro(res, 'Informe o nome do setor.');
  if (one('SELECT 1 FROM setores WHERE nome = ? AND id <> ?', nome, Number(req.params.id))) return erro(res, 'Já existe um setor com esse nome.');
  run('UPDATE setores SET nome = ?, descricao = ? WHERE id = ?', nome, texto(req.body?.descricao) || null, Number(req.params.id));
  res.json(one('SELECT * FROM setores WHERE id = ?', Number(req.params.id)));
});

rotasRH.delete('/setores/:id', (req, res) => {
  const id = Number(req.params.id);
  if (one('SELECT 1 FROM cargos WHERE setor_id = ?', id)) return erro(res, 'Remova os cargos do setor antes de excluí-lo.');
  if (one('SELECT 1 FROM usuarios WHERE setor_id = ?', id)) return erro(res, 'Há colaboradores neste setor.');
  run('DELETE FROM setores WHERE id = ?', id);
  res.json({ ok: true });
});

// ---------------- Lojas ----------------

rotasRH.get('/lojas', (_req, res) => {
  res.json(all(`SELECT l.*, (SELECT COUNT(*) FROM usuarios u WHERE u.loja_id = l.id AND u.ativo = 1) AS colaboradores FROM lojas l ORDER BY l.nome`));
});

rotasRH.post('/lojas', (req, res) => {
  const nome = texto(req.body?.nome);
  if (!nome) return erro(res, 'Informe o nome da loja.');
  if (one('SELECT 1 FROM lojas WHERE nome = ?', nome)) return erro(res, 'Já existe uma loja com esse nome.');
  const { lastInsertRowid } = run('INSERT INTO lojas (nome, cidade) VALUES (?, ?)', nome, texto(req.body?.cidade) || null);
  res.status(201).json(one('SELECT * FROM lojas WHERE id = ?', lastInsertRowid));
});

rotasRH.put('/lojas/:id', (req, res) => {
  const id = Number(req.params.id);
  const nome = texto(req.body?.nome);
  if (!nome) return erro(res, 'Informe o nome da loja.');
  if (one('SELECT 1 FROM lojas WHERE nome = ? AND id <> ?', nome, id)) return erro(res, 'Já existe uma loja com esse nome.');
  run('UPDATE lojas SET nome = ?, cidade = ? WHERE id = ?', nome, texto(req.body?.cidade) || null, id);
  res.json(one('SELECT * FROM lojas WHERE id = ?', id));
});

rotasRH.delete('/lojas/:id', (req, res) => {
  const id = Number(req.params.id);
  if (one('SELECT 1 FROM usuarios WHERE loja_id = ?', id)) return erro(res, 'Há colaboradores nesta loja.');
  run('DELETE FROM lojas WHERE id = ?', id);
  res.json({ ok: true });
});

// ---------------- Cargos, funções e riscos ----------------

const CAMPOS_RISCO = ['movimentos_repetitivos', 'horas_em_pe', 'horas_sentado', 'carrega_peso', 'ambiente_frio',
  'ambiente_calor', 'turno_noturno', 'atendimento_publico'];

function cargoCompleto(id) {
  const cargo = one('SELECT c.*, s.nome AS setor FROM cargos c JOIN setores s ON s.id = c.setor_id WHERE c.id = ?', id);
  if (!cargo) return null;
  return {
    ...cargo,
    funcoes: all('SELECT id, nome, descricao FROM funcoes WHERE cargo_id = ? ORDER BY id', id),
    riscos: one('SELECT * FROM cargo_riscos WHERE cargo_id = ?', id),
    colaboradores: one('SELECT COUNT(*) AS n FROM usuarios WHERE cargo_id = ? AND ativo = 1', id).n,
  };
}

function normalizarRiscos(r = {}) {
  const v = {};
  for (const campo of ['movimentos_repetitivos', 'carrega_peso', 'atendimento_publico']) {
    v[campo] = Math.min(3, Math.max(0, Math.round(Number(r[campo]) || 0)));
  }
  for (const campo of ['horas_em_pe', 'horas_sentado']) v[campo] = Math.min(24, Math.max(0, Number(r[campo]) || 0));
  for (const campo of ['ambiente_frio', 'ambiente_calor', 'turno_noturno']) v[campo] = r[campo] ? 1 : 0;
  const regioes = Array.isArray(r.regioes_sobrecarga) ? r.regioes_sobrecarga : String(r.regioes_sobrecarga ?? '').split(',');
  v.regioes_sobrecarga = regioes.map((s) => s.trim()).filter((s) => REGIOES.includes(s)).join(',');
  v.observacoes = texto(r.observacoes) || null;
  return v;
}

function salvarDetalhesCargo(cargoId, { funcoes, riscos }) {
  if (Array.isArray(funcoes)) {
    run('DELETE FROM funcoes WHERE cargo_id = ?', cargoId);
    for (const f of funcoes) {
      if (texto(f.nome)) run('INSERT INTO funcoes (cargo_id, nome, descricao) VALUES (?, ?, ?)', cargoId, texto(f.nome), texto(f.descricao) || null);
    }
  }
  if (riscos) {
    const r = normalizarRiscos(riscos);
    const campos = [...CAMPOS_RISCO, 'regioes_sobrecarga', 'observacoes'];
    run(
      `INSERT INTO cargo_riscos (cargo_id, ${campos.join(', ')}) VALUES (?, ${campos.map(() => '?').join(', ')})
       ON CONFLICT (cargo_id) DO UPDATE SET ${campos.map((c) => `${c} = excluded.${c}`).join(', ')}`,
      cargoId, ...campos.map((c) => r[c]),
    );
  }
}

rotasRH.get('/cargos', (req, res) => {
  const setor = req.query.setor_id ? Number(req.query.setor_id) : null;
  const ids = all(`SELECT id FROM cargos ${setor ? 'WHERE setor_id = ?' : ''} ORDER BY nome`, ...(setor ? [setor] : []));
  res.json({ cargos: ids.map((c) => cargoCompleto(c.id)), opcoes: { niveis: NIVEIS_RISCO, regioes: REGIOES } });
});

rotasRH.post('/cargos', (req, res) => {
  const { setor_id: setorId, nome, descricao } = req.body ?? {};
  if (!one('SELECT 1 FROM setores WHERE id = ?', Number(setorId))) return erro(res, 'Escolha um setor válido.');
  if (!texto(nome)) return erro(res, 'Informe o nome do cargo.');
  if (one('SELECT 1 FROM cargos WHERE setor_id = ? AND nome = ?', Number(setorId), texto(nome))) return erro(res, 'Esse cargo já existe no setor.');
  const id = transaction(() => {
    const { lastInsertRowid } = run('INSERT INTO cargos (setor_id, nome, descricao) VALUES (?, ?, ?)', Number(setorId), texto(nome), texto(descricao) || null);
    salvarDetalhesCargo(Number(lastInsertRowid), { funcoes: req.body.funcoes ?? [], riscos: req.body.riscos ?? {} });
    return Number(lastInsertRowid);
  });
  res.status(201).json(cargoCompleto(id));
});

rotasRH.put('/cargos/:id', (req, res) => {
  const id = Number(req.params.id);
  const atual = one('SELECT * FROM cargos WHERE id = ?', id);
  if (!atual) return erro(res, 'Cargo não encontrado.', 404);
  const nome = texto(req.body?.nome) || atual.nome;
  if (one('SELECT 1 FROM cargos WHERE setor_id = ? AND nome = ? AND id <> ?', atual.setor_id, nome, id)) return erro(res, 'Esse cargo já existe no setor.');
  transaction(() => {
    // A nova versão do cargo passa a valer para os próximos desafios gerados.
    run(`UPDATE cargos SET nome = ?, descricao = ?, versao = versao + 1, updated_at = datetime('now') WHERE id = ?`,
      nome, req.body && 'descricao' in req.body ? texto(req.body.descricao) || null : atual.descricao, id);
    salvarDetalhesCargo(id, req.body ?? {});
  });
  res.json(cargoCompleto(id));
});

rotasRH.delete('/cargos/:id', (req, res) => {
  const id = Number(req.params.id);
  if (one('SELECT 1 FROM usuarios WHERE cargo_id = ?', id)) return erro(res, 'Há colaboradores neste cargo.');
  run('DELETE FROM cargos WHERE id = ?', id);
  res.json({ ok: true });
});

// ---------------- Colaboradores ----------------

const SELECT_COLABORADOR = `
  SELECT u.id, u.matricula, u.nome, u.data_nascimento, u.sexo, u.setor_id, u.cargo_id, u.loja_id, u.papel, u.ativo,
         u.deve_trocar_senha, u.ultimo_acesso, u.email, u.telefone, s.nome AS setor, c.nome AS cargo, l.nome AS loja,
         COALESCE((SELECT SUM(pontos) FROM pontos_lancamentos p WHERE p.usuario_id = u.id), 0) AS saldo
  FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id LEFT JOIN cargos c ON c.id = u.cargo_id
  LEFT JOIN lojas l ON l.id = u.loja_id`;

rotasRH.get('/colaboradores', (req, res) => {
  const filtros = ["u.papel = 'colaborador'"];
  const params = [];
  if (req.query.setor_id) { filtros.push('u.setor_id = ?'); params.push(Number(req.query.setor_id)); }
  if (req.query.loja_id) { filtros.push('u.loja_id = ?'); params.push(Number(req.query.loja_id)); }
  if (req.query.busca) { filtros.push('(u.nome LIKE ? OR u.matricula LIKE ?)'); params.push(`%${req.query.busca}%`, `%${req.query.busca}%`); }
  res.json(all(`${SELECT_COLABORADOR} WHERE ${filtros.join(' AND ')} ORDER BY u.nome`, ...params));
});

function validarColaborador(d, idAtual = null) {
  const nome = texto(d.nome).replace(/\s+/g, ' ');
  const matricula = texto(d.matricula);
  const data = converterData(d.data_nascimento);
  const sexo = converterSexo(d.sexo);
  const setorId = Number(d.setor_id);
  const cargoId = Number(d.cargo_id);
  if (!nome) return { erro: 'Informe o nome.' };
  if (!/^[A-Za-z0-9._-]{1,30}$/.test(matricula)) return { erro: 'Matrícula inválida.' };
  if (one('SELECT 1 FROM usuarios WHERE matricula = ? AND id IS NOT ?', matricula, idAtual)) return { erro: 'Matrícula já cadastrada.' };
  if (!data) return { erro: 'Data de nascimento inválida.' };
  if (!sexo) return { erro: 'Sexo inválido.' };
  if (!one('SELECT 1 FROM cargos WHERE id = ? AND setor_id = ?', cargoId, setorId)) return { erro: 'Escolha um setor e um cargo desse setor.' };
  const lojaId = d.loja_id ? Number(d.loja_id) : null;
  if (lojaId && !one('SELECT 1 FROM lojas WHERE id = ?', lojaId)) return { erro: 'Loja inválida.' };
  return { valores: { nome, matricula, data_nascimento: data, sexo, setor_id: setorId, cargo_id: cargoId, loja_id: lojaId } };
}

rotasRH.post('/colaboradores', (req, res) => {
  const { erro: msg, valores: v } = validarColaborador(req.body ?? {});
  if (msg) return erro(res, msg);
  const { lastInsertRowid } = run(
    `INSERT INTO usuarios (matricula, nome, data_nascimento, sexo, setor_id, cargo_id, loja_id, senha_hash, deve_trocar_senha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    v.matricula, v.nome, v.data_nascimento, v.sexo, v.setor_id, v.cargo_id, v.loja_id, hashSenha(config.senhaInicial),
  );
  res.status(201).json(one(`${SELECT_COLABORADOR} WHERE u.id = ?`, lastInsertRowid));
});

rotasRH.put('/colaboradores/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!one(`SELECT 1 FROM usuarios WHERE id = ? AND papel = 'colaborador'`, id)) return erro(res, 'Colaborador não encontrado.', 404);
  const { erro: msg, valores: v } = validarColaborador(req.body ?? {}, id);
  if (msg) return erro(res, msg);
  run(
    `UPDATE usuarios SET matricula = ?, nome = ?, data_nascimento = ?, sexo = ?, setor_id = ?, cargo_id = ?, loja_id = ?, ativo = ?,
       updated_at = datetime('now') WHERE id = ?`,
    v.matricula, v.nome, v.data_nascimento, v.sexo, v.setor_id, v.cargo_id, v.loja_id, req.body.ativo === false ? 0 : 1, id,
  );
  if (req.body.ativo === false) run('DELETE FROM sessoes WHERE usuario_id = ?', id);
  res.json(one(`${SELECT_COLABORADOR} WHERE u.id = ?`, id));
});

rotasRH.post('/colaboradores/:id/resetar-senha', (req, res) => {
  const id = Number(req.params.id);
  run(`UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 1 WHERE id = ? AND papel = 'colaborador'`, hashSenha(config.senhaInicial), id);
  run('DELETE FROM sessoes WHERE usuario_id = ?', id);
  res.json({ ok: true, mensagem: `Senha redefinida para ${config.senhaInicial}. O colaborador deverá trocá-la no próximo acesso.` });
});

rotasRH.get('/colaboradores/:id/desafios', (req, res) => {
  res.json(all(
    `SELECT d.id, d.titulo, d.categoria, d.status, d.pontos, d.prazo, d.created_at, d.concluido_em, d.motivo
     FROM desafios d WHERE d.usuario_id = ? ORDER BY d.created_at DESC`,
    Number(req.params.id),
  ));
});

// ---------------- Importação de planilha ----------------

rotasRH.get('/importacao/modelo', (_req, res) => {
  const exemplo = ['Maria da Silva', '10001', '15/03/1985', 'F', 'Frente de Caixa', 'Operador(a) de Caixa', 'Loja Centro'];
  res.attachment('modelo-colaboradores.csv').type('text/csv')
    .send(`\uFEFF${[...COLUNAS, 'loja'].join(';')}\n${exemplo.join(';')}\n`);
});

async function analisarPlanilha(req) {
  if (!req.file) return { erroGeral: 'Anexe a planilha (.xlsx ou .csv).', linhas: [] };
  try {
    return validarLinhas(await lerPlanilha(req.file.buffer, req.file.originalname));
  } catch (e) {
    return { erroGeral: `Não foi possível ler a planilha: ${e.message}`, linhas: [] };
  }
}

const resumir = (linhas) => ({
  total: linhas.length,
  validas: linhas.filter((l) => l.valido).length,
  com_erro: linhas.filter((l) => !l.valido).length,
  com_aviso: linhas.filter((l) => l.avisos.length).length,
});

rotasRH.post('/importacao/previa', uploadPlanilha.single('planilha'), async (req, res) => {
  const resultado = await analisarPlanilha(req);
  res.json({ ...resultado, resumo: resumir(resultado.linhas) });
});

// A confirmação reenvia a planilha e a valida de novo, para não importar nada que tenha mudado desde a prévia.
rotasRH.post('/importacao/confirmar', uploadPlanilha.single('planilha'), async (req, res) => {
  const resultado = await analisarPlanilha(req);
  if (resultado.erroGeral) return erro(res, resultado.erroGeral);
  const senha = hashSenha(config.senhaInicial);
  let criados = 0, atualizados = 0;
  transaction(() => {
    for (const { valido, dados: d } of resultado.linhas) {
      if (!valido) continue;
      const existente = one('SELECT id FROM usuarios WHERE matricula = ?', d.matricula);
      if (existente) {
        run(`UPDATE usuarios SET nome = ?, data_nascimento = ?, sexo = ?, setor_id = ?, cargo_id = ?, loja_id = COALESCE(?, loja_id),
               updated_at = datetime('now') WHERE id = ?`,
          d.nome, d.data_nascimento, d.sexo, d.setor_id, d.cargo_id, d.loja_id ?? null, existente.id);
        atualizados++;
      } else {
        run(`INSERT INTO usuarios (matricula, nome, data_nascimento, sexo, setor_id, cargo_id, loja_id, senha_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          d.matricula, d.nome, d.data_nascimento, d.sexo, d.setor_id, d.cargo_id, d.loja_id ?? null, senha);
        criados++;
      }
    }
  });
  res.json({ criados, atualizados, ignorados: resultado.linhas.filter((l) => !l.valido), resumo: resumir(resultado.linhas) });
});

// ---------------- Vídeos explicativos ----------------

rotasRH.get('/videos', (_req, res) => {
  const videos = new Map(listarVideos().map((v) => [v.modelo_codigo, v]));
  res.json(MODELOS.map((m) => ({
    codigo: m.codigo, titulo: m.titulo, categoria: m.categoria,
    video: videos.get(m.codigo) ? { ...videos.get(m.codigo), exibicao: converterVideo(videos.get(m.codigo).url) } : null,
  })));
});

rotasRH.put('/videos/:codigo', (req, res) => {
  const codigo = req.params.codigo;
  if (!MODELOS.some((m) => m.codigo === codigo)) return erro(res, 'Desafio não encontrado.', 404);
  const url = texto(req.body?.url);
  if (!url) {
    run('DELETE FROM modelo_videos WHERE modelo_codigo = ?', codigo);
    return res.json({ ok: true, removido: true });
  }
  const exibicao = converterVideo(url);
  if (!exibicao) return erro(res, 'Link não reconhecido. Use um link https do YouTube, do Vimeo ou de um arquivo .mp4/.webm.');
  run(
    `INSERT INTO modelo_videos (modelo_codigo, url, titulo) VALUES (?, ?, ?)
     ON CONFLICT (modelo_codigo) DO UPDATE SET url = excluded.url, titulo = excluded.titulo, atualizado_em = datetime('now')`,
    codigo, url, texto(req.body?.titulo) || null,
  );
  res.json({ ok: true, exibicao });
});

// ---------------- Desafios ----------------

rotasRH.post('/desafios/gerar', (_req, res) => {
  const usuarios = all(`SELECT id FROM usuarios WHERE papel = 'colaborador' AND ativo = 1`);
  const total = usuarios.reduce((n, u) => n + gerarDesafios(u.id).length, 0);
  res.json({ colaboradores: usuarios.length, desafios_criados: total });
});

// ---------------- Comprovantes ----------------

rotasRH.get('/comprovantes', (req, res) => {
  const status = ['em_analise', 'aprovado', 'recusado'].includes(req.query.status) ? req.query.status : null;
  res.json(all(
    `SELECT c.id, c.status, c.motivo, c.suspeita_ia, c.validado_por, c.created_at, c.validado_em, c.nome_original, c.mime,
            d.titulo AS desafio, d.categoria, u.nome, u.matricula, s.nome AS setor
     FROM comprovantes c JOIN desafios d ON d.id = c.desafio_id JOIN usuarios u ON u.id = c.usuario_id
     LEFT JOIN setores s ON s.id = u.setor_id
     ${status ? 'WHERE c.status = ?' : ''} ORDER BY c.id DESC LIMIT 300`,
    ...(status ? [status] : []),
  ));
});

rotasRH.get('/comprovantes/:id', (req, res) => {
  const c = one('SELECT * FROM comprovantes WHERE id = ?', Number(req.params.id));
  if (!c) return erro(res, 'Comprovante não encontrado.', 404);
  const desafio = one('SELECT * FROM desafios WHERE id = ?', c.desafio_id);
  const { arquivo: _, ...resto } = c;
  res.json({ ...resto, analise: c.analise ? JSON.parse(c.analise) : null, desafio: { ...desafio, criterios: JSON.parse(desafio.criterios) } });
});

rotasRH.get('/comprovantes/:id/arquivo', (req, res) => {
  const c = one('SELECT * FROM comprovantes WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).end();
  res.type(c.mime).sendFile(c.arquivo);
});

// Revisão manual: usada quando a IA não está disponível ou para corrigir uma decisão.
rotasRH.post('/comprovantes/:id/decisao', (req, res) => {
  const id = Number(req.params.id);
  const c = one('SELECT * FROM comprovantes WHERE id = ?', id);
  if (!c) return erro(res, 'Comprovante não encontrado.', 404);
  const { status, motivo } = req.body ?? {};
  if (!['aprovado', 'recusado'].includes(status)) return erro(res, 'Escolha aprovar ou recusar.');
  if (status === 'recusado' && !texto(motivo)) return erro(res, 'Informe o motivo da recusa.');
  if (c.status === 'aprovado') return erro(res, 'Este comprovante já foi aprovado e os pontos já foram creditados.');
  const desafio = one('SELECT status FROM desafios WHERE id = ?', c.desafio_id);
  if (status === 'aprovado' && desafio.status === 'concluido') return erro(res, 'O desafio já foi concluído por outro comprovante.');
  if (c.status === 'recusado' && status === 'aprovado' && desafio.status !== 'ativo' && desafio.status !== 'expirado') {
    return erro(res, 'Já existe outro comprovante em análise para este desafio.');
  }
  registrarResultado(id, {
    status,
    motivo: texto(motivo) || 'Comprovante aprovado pelo RH.',
    suspeitaIa: Boolean(c.suspeita_ia),
    validadoPor: `rh:${req.usuario.id}`,
  });
  res.json({ ok: true });
});

rotasRH.post('/comprovantes/:id/reprocessar', async (req, res) => {
  const c = one('SELECT * FROM comprovantes WHERE id = ?', Number(req.params.id));
  if (!c) return erro(res, 'Comprovante não encontrado.', 404);
  if (c.status !== 'em_analise') return erro(res, 'Só é possível reprocessar comprovantes em análise.');
  if (!config.iaHabilitada) return erro(res, 'A validação por IA não está configurada (defina ANTHROPIC_API_KEY).');
  await validarComprovante(c.id);
  res.json(one('SELECT id, status, motivo FROM comprovantes WHERE id = ?', c.id));
});

// ---------------- Painel de engajamento ----------------

rotasRH.get('/painel', (req, res) => {
  const dias = [7, 30, 90, 365].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
  const lojaId = req.query.loja_id ? Number(req.query.loja_id) : null;
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

  // Engajado = enviou pelo menos um comprovante no período.
  const porColaborador = all(
    `SELECT u.id, u.nome, u.matricula, s.id AS setor_id, s.nome AS setor, c.nome AS cargo, u.ultimo_acesso,
       (SELECT COUNT(*) FROM desafios d WHERE d.usuario_id = u.id AND d.status = 'concluido' AND d.concluido_em >= ?) AS concluidos,
       (SELECT COUNT(*) FROM comprovantes k WHERE k.usuario_id = u.id AND k.created_at >= ?) AS enviados,
       (SELECT COUNT(*) FROM comprovantes k WHERE k.usuario_id = u.id AND k.status = 'recusado' AND k.created_at >= ?) AS recusados,
       (SELECT COUNT(*) FROM desafios d WHERE d.usuario_id = u.id AND d.status = 'expirado' AND d.prazo >= date(?)) AS expirados,
       COALESCE((SELECT SUM(p.pontos) FROM pontos_lancamentos p WHERE p.usuario_id = u.id AND p.origem IN ('desafio','pausa_ativa') AND p.created_at >= ?), 0) AS pontos_periodo,
       (SELECT COUNT(*) FROM pausas_ativas a WHERE a.usuario_id = u.id AND a.concluida_em IS NOT NULL AND a.iniciada_em >= ?) AS pausas,
       COALESCE((SELECT SUM(p.pontos) FROM pontos_lancamentos p WHERE p.usuario_id = u.id), 0) AS saldo
     FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id LEFT JOIN cargos c ON c.id = u.cargo_id
     WHERE u.papel = 'colaborador' AND u.ativo = 1 AND (? IS NULL OR u.loja_id = ?)
     ORDER BY pontos_periodo DESC, u.nome`,
    desde, desde, desde, desde, desde, desde, lojaId, lojaId,
  );

  const setores = new Map();
  for (const c of porColaborador) {
    const chave = c.setor ?? 'Sem setor';
    const s = setores.get(chave) ?? { setor: chave, colaboradores: 0, engajados: 0, concluidos: 0, recusados: 0, pontos: 0 };
    s.colaboradores++;
    if (c.enviados > 0) s.engajados++;
    s.concluidos += c.concluidos;
    s.recusados += c.recusados;
    s.pontos += c.pontos_periodo;
    setores.set(chave, s);
  }
  const porSetor = [...setores.values()]
    .map((s) => ({ ...s, engajamento: s.colaboradores ? Math.round((s.engajados / s.colaboradores) * 100) : 0 }))
    .sort((a, b) => b.engajamento - a.engajamento);

  const totais = porColaborador.reduce((t, c) => ({
    colaboradores: t.colaboradores + 1,
    engajados: t.engajados + (c.enviados > 0 ? 1 : 0),
    concluidos: t.concluidos + c.concluidos,
    recusados: t.recusados + c.recusados,
    pontos: t.pontos + c.pontos_periodo,
    pausas: t.pausas + c.pausas,
  }), { colaboradores: 0, engajados: 0, concluidos: 0, recusados: 0, pontos: 0, pausas: 0 });
  totais.engajamento = totais.colaboradores ? Math.round((totais.engajados / totais.colaboradores) * 100) : 0;
  totais.em_analise = one(`SELECT COUNT(*) AS n FROM comprovantes WHERE status = 'em_analise'`).n;

  const cumpridos = all(
    `SELECT d.id, d.titulo, d.categoria, d.pontos, d.concluido_em, u.nome, s.nome AS setor
     FROM desafios d JOIN usuarios u ON u.id = d.usuario_id LEFT JOIN setores s ON s.id = u.setor_id
     WHERE d.status = 'concluido' AND d.concluido_em >= ? AND (? IS NULL OR u.loja_id = ?) ORDER BY d.concluido_em DESC LIMIT 50`,
    desde, lojaId, lojaId,
  );
  const recusados = all(
    `SELECT k.id, k.motivo, k.suspeita_ia, k.created_at, d.titulo AS desafio, u.nome, s.nome AS setor
     FROM comprovantes k JOIN desafios d ON d.id = k.desafio_id JOIN usuarios u ON u.id = k.usuario_id
     LEFT JOIN setores s ON s.id = u.setor_id
     WHERE k.status = 'recusado' AND k.created_at >= ? AND (? IS NULL OR u.loja_id = ?) ORDER BY k.id DESC LIMIT 50`,
    desde, lojaId, lojaId,
  );
  const porCategoria = all(
    `SELECT d.categoria, COUNT(*) AS concluidos FROM desafios d JOIN usuarios u ON u.id = d.usuario_id
     WHERE d.status = 'concluido' AND d.concluido_em >= ? AND (? IS NULL OR u.loja_id = ?) GROUP BY d.categoria`,
    desde, lojaId, lojaId,
  );

  const resgatesPendentes = one(`SELECT COUNT(*) AS n FROM resgates WHERE status IN ('solicitado','aprovado')`).n;
  res.json({
    dias, loja_id: lojaId, totais, porSetor, porColaborador, cumpridos, recusados, porCategoria,
    lojas: all('SELECT id, nome FROM lojas ORDER BY nome'), ranking: ranking(),
    ia_habilitada: config.iaHabilitada, canais: canaisConfigurados(), resgates_pendentes: resgatesPendentes,
  });
});

// ---------------- Recompensas (parceiros, catálogo e resgates) ----------------

rotasRH.get('/parceiros', (_req, res) => res.json(all('SELECT * FROM parceiros ORDER BY nome')));

rotasRH.post('/parceiros', (req, res) => {
  const nome = texto(req.body?.nome);
  if (!nome) return erro(res, 'Informe o nome do parceiro.');
  const { lastInsertRowid } = run('INSERT INTO parceiros (nome, contato) VALUES (?, ?)', nome, texto(req.body?.contato) || null);
  res.status(201).json(one('SELECT * FROM parceiros WHERE id = ?', lastInsertRowid));
});

rotasRH.put('/parceiros/:id', (req, res) => {
  const nome = texto(req.body?.nome);
  if (!nome) return erro(res, 'Informe o nome do parceiro.');
  run('UPDATE parceiros SET nome = ?, contato = ?, ativo = ? WHERE id = ?', nome, texto(req.body?.contato) || null, req.body?.ativo === false ? 0 : 1, Number(req.params.id));
  res.json(one('SELECT * FROM parceiros WHERE id = ?', Number(req.params.id)));
});

function validarRecompensa(b) {
  const titulo = texto(b.titulo);
  const custo = Number(b.custo_pontos);
  const estoque = b.estoque === '' || b.estoque == null ? null : Number(b.estoque);
  const parceiroId = b.parceiro_id ? Number(b.parceiro_id) : null;
  if (!titulo) return { erro: 'Informe o título.' };
  if (!TIPOS_RECOMPENSA.includes(b.tipo)) return { erro: 'Tipo inválido.' };
  if (!Number.isInteger(custo) || custo <= 0) return { erro: 'O custo em pontos deve ser um número inteiro maior que zero.' };
  if (estoque !== null && (!Number.isInteger(estoque) || estoque < 0)) return { erro: 'Estoque inválido (deixe vazio para ilimitado).' };
  if (parceiroId && !one('SELECT 1 FROM parceiros WHERE id = ?', parceiroId)) return { erro: 'Parceiro inválido.' };
  return { v: { titulo, descricao: texto(b.descricao) || null, tipo: b.tipo, custo, estoque, parceiroId, ativo: b.ativo === false ? 0 : 1 } };
}

rotasRH.get('/recompensas', (_req, res) => {
  res.json({
    tipos: TIPOS_RECOMPENSA,
    itens: all(`SELECT r.*, p.nome AS parceiro, (SELECT COUNT(*) FROM resgates g WHERE g.recompensa_id = r.id AND g.status <> 'cancelado') AS resgates
                FROM recompensas r LEFT JOIN parceiros p ON p.id = r.parceiro_id ORDER BY r.ativo DESC, r.custo_pontos`),
  });
});

rotasRH.post('/recompensas', (req, res) => {
  const { erro: msg, v } = validarRecompensa(req.body ?? {});
  if (msg) return erro(res, msg);
  const { lastInsertRowid } = run(
    'INSERT INTO recompensas (parceiro_id, titulo, descricao, tipo, custo_pontos, estoque, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)',
    v.parceiroId, v.titulo, v.descricao, v.tipo, v.custo, v.estoque, v.ativo,
  );
  res.status(201).json(one('SELECT * FROM recompensas WHERE id = ?', lastInsertRowid));
});

rotasRH.put('/recompensas/:id', (req, res) => {
  const { erro: msg, v } = validarRecompensa(req.body ?? {});
  if (msg) return erro(res, msg);
  run('UPDATE recompensas SET parceiro_id = ?, titulo = ?, descricao = ?, tipo = ?, custo_pontos = ?, estoque = ?, ativo = ? WHERE id = ?',
    v.parceiroId, v.titulo, v.descricao, v.tipo, v.custo, v.estoque, v.ativo, Number(req.params.id));
  res.json(one('SELECT * FROM recompensas WHERE id = ?', Number(req.params.id)));
});

rotasRH.get('/resgates', (req, res) => {
  const status = ['solicitado', 'aprovado', 'entregue', 'cancelado'].includes(req.query.status) ? req.query.status : null;
  res.json(all(
    `SELECT g.*, r.titulo, r.tipo, p.nome AS parceiro, u.nome, u.matricula, l.nome AS loja, s.nome AS setor
     FROM resgates g JOIN recompensas r ON r.id = g.recompensa_id LEFT JOIN parceiros p ON p.id = r.parceiro_id
     JOIN usuarios u ON u.id = g.usuario_id LEFT JOIN lojas l ON l.id = u.loja_id LEFT JOIN setores s ON s.id = u.setor_id
     ${status ? 'WHERE g.status = ?' : ''} ORDER BY g.id DESC LIMIT 300`,
    ...(status ? [status] : []),
  ));
});

rotasRH.post('/resgates/:id/status', async (req, res) => {
  try {
    await atualizarResgate(Number(req.params.id), req.body?.status, {
      codigoVoucher: texto(req.body?.codigo_voucher) || null, observacao: texto(req.body?.observacao) || null,
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ErroResgate) return erro(res, err.message);
    throw err;
  }
});

// ---------------- Lembretes e ranking ----------------

rotasRH.post('/lembretes/executar', async (_req, res) => {
  res.json({ enviados: await executarLembretes(), canais: canaisConfigurados() });
});

rotasRH.get('/ranking', (req, res) => res.json(ranking(req.query.mes)));
