import crypto from 'node:crypto';
import { one, run } from './db.js';
import { config } from './config.js';

const COOKIE = 'sessao';

export function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function conferirSenha(senha, armazenado) {
  const [salt, hash] = armazenado.split(':');
  const calculado = crypto.scryptSync(senha, salt, 64);
  return crypto.timingSafeEqual(calculado, Buffer.from(hash, 'hex'));
}

/** Regras para a nova senha. Retorna a mensagem de erro ou null. */
export function validarNovaSenha(senha, matricula) {
  if (typeof senha !== 'string' || senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  if (senha === config.senhaInicial) return 'A nova senha não pode ser a senha inicial.';
  if (senha === matricula) return 'A senha não pode ser igual à matrícula.';
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.';
  return null;
}

export function criarSessao(res, usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + config.sessaoHoras * 3600_000);
  run('DELETE FROM sessoes WHERE expira_em < ?', new Date().toISOString());
  run('INSERT INTO sessoes (token, usuario_id, expira_em) VALUES (?, ?, ?)', token, usuarioId, expira.toISOString());
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: expira,
  });
}

export function encerrarSessao(req, res) {
  const token = lerToken(req);
  if (token) run('DELETE FROM sessoes WHERE token = ?', token);
  res.clearCookie(COOKIE);
}

function lerToken(req) {
  const header = req.headers.cookie ?? '';
  for (const parte of header.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Carrega o usuário da sessão em req.usuario (ou deixa indefinido). */
export function carregarUsuario(req, _res, next) {
  const token = lerToken(req);
  if (token) {
    const usuario = one(
      `SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expira_em > ? AND u.ativo = 1`,
      token, new Date().toISOString(),
    );
    if (usuario) req.usuario = usuario;
  }
  next();
}

/** Exige login. Enquanto a senha inicial não for trocada, só libera as rotas de senha/sessão. */
export function exigirLogin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Faça login para continuar.' });
  if (req.usuario.deve_trocar_senha && !req.liberadoSemTrocaSenha) {
    return res.status(403).json({ erro: 'Troque a senha inicial para continuar.', codigo: 'TROCAR_SENHA' });
  }
  next();
}

export function permitirSemTrocaSenha(req, _res, next) {
  req.liberadoSemTrocaSenha = true;
  next();
}

export function exigirRH(req, res, next) {
  if (req.usuario?.papel !== 'rh') return res.status(403).json({ erro: 'Acesso restrito ao RH.' });
  next();
}
