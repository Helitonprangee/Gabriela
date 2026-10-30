// Banco e uploads temporários para cada execução de teste (antes de importar o app).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-saude-'));
process.env.DB_PATH = path.join(dir, 'teste.db');
process.env.UPLOAD_DIR = path.join(dir, 'uploads');
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
