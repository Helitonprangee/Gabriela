import express from 'express';
import path from 'node:path';
import multer from 'multer';
import { config } from './config.js';
import { one, run } from './db.js';
import { carregarUsuario, exigirLogin, exigirRH, hashSenha } from './auth.js';
import { rotasAuth } from './routes/auth.js';
import { rotasColaborador } from './routes/colaborador.js';
import { rotasRH } from './routes/rh.js';

// Primeiro acesso do RH: cria o usuário "rh" com a senha inicial, que precisa ser trocada.
if (!one(`SELECT 1 FROM usuarios WHERE papel = 'rh'`)) {
  run(`INSERT INTO usuarios (matricula, nome, papel, senha_hash) VALUES ('rh', 'Recursos Humanos', 'rh', ?)`, hashSenha(config.senhaInicial));
  console.log(`Usuário do RH criado: matrícula "rh", senha inicial "${config.senhaInicial}".`);
}

export const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; frame-src 'self' blob:; object-src 'self' blob:",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  next();
});
app.use(express.json({ limit: '200kb' }));
app.use(carregarUsuario);

app.use('/api/auth', rotasAuth);
app.use('/api/rh', exigirLogin, exigirRH, rotasRH);
app.use('/api', exigirLogin, rotasColaborador);
app.use(express.static(path.join(config.root, 'public')));

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `O arquivo deve ter no máximo ${config.maxUploadMb} MB.` : 'Falha no envio do arquivo.';
    return res.status(400).json({ erro: msg });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
});

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(config.root, 'src/server.js')) {
  app.listen(config.port, () => {
    console.log(`Portal de Saúde rodando em http://localhost:${config.port}`);
    if (!config.iaHabilitada) console.log('Aviso: ANTHROPIC_API_KEY não definida; comprovantes ficarão para revisão manual do RH.');
  });
}
