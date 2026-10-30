import { Router } from 'express';
import { one, run } from '../db.js';
import {
  conferirSenha, criarSessao, encerrarSessao, exigirLogin, hashSenha, permitirSemTrocaSenha, validarNovaSenha,
} from '../auth.js';
import { config } from '../config.js';

export const rotasAuth = Router();

// Limite simples de tentativas por matrícula para dificultar adivinhação de senha.
const tentativas = new Map();
const LIMITE = 5;
const BLOQUEIO_MS = 15 * 60_000;

rotasAuth.post('/login', (req, res) => {
  const matricula = String(req.body?.matricula ?? '').trim();
  const senha = String(req.body?.senha ?? '');
  const t = tentativas.get(matricula);
  if (t && t.contagem >= LIMITE && Date.now() - t.ultima < BLOQUEIO_MS) {
    return res.status(429).json({ erro: 'Muitas tentativas. Aguarde 15 minutos ou procure o RH.' });
  }
  const usuario = one('SELECT * FROM usuarios WHERE matricula = ? AND ativo = 1', matricula);
  if (!usuario || !conferirSenha(senha, usuario.senha_hash)) {
    tentativas.set(matricula, { contagem: (t?.contagem ?? 0) + 1, ultima: Date.now() });
    return res.status(401).json({ erro: 'Matrícula ou senha incorretas.' });
  }
  tentativas.delete(matricula);
  run(`UPDATE usuarios SET ultimo_acesso = datetime('now') WHERE id = ?`, usuario.id);
  criarSessao(res, usuario.id);
  res.json({ papel: usuario.papel, deve_trocar_senha: Boolean(usuario.deve_trocar_senha) });
});

rotasAuth.post('/logout', (req, res) => {
  encerrarSessao(req, res);
  res.json({ ok: true });
});

rotasAuth.get('/sessao', (req, res) => {
  const u = req.usuario;
  if (!u) return res.json({ usuario: null });
  res.json({
    usuario: {
      id: u.id, nome: u.nome, matricula: u.matricula, papel: u.papel,
      deve_trocar_senha: Boolean(u.deve_trocar_senha),
      recursos: { recompensas: config.recompensasHabilitadas },
    },
  });
});

rotasAuth.post('/trocar-senha', permitirSemTrocaSenha, exigirLogin, (req, res) => {
  const { senha_atual: atual, nova_senha: nova } = req.body ?? {};
  if (!conferirSenha(String(atual ?? ''), req.usuario.senha_hash)) {
    return res.status(400).json({ erro: 'A senha atual está incorreta.' });
  }
  const erro = validarNovaSenha(nova, req.usuario.matricula);
  if (erro) return res.status(400).json({ erro });
  run(`UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 0, updated_at = datetime('now') WHERE id = ?`,
    hashSenha(nova), req.usuario.id);
  res.json({ ok: true });
});
