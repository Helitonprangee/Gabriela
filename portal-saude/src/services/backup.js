import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { config } from '../config.js';

/**
 * Backup consistente do banco (VACUUM INTO, seguro com o sistema em uso) e cópia
 * incremental dos comprovantes. Mantém os últimos N dias.
 */
export function fazerBackup({ dir = config.backup.dir, hoje = new Date(), diasRetencao = config.backup.diasRetencao } = {}) {
  if (!dir) return null;
  fs.mkdirSync(dir, { recursive: true });
  const dia = hoje.toISOString().slice(0, 10);
  const arquivo = path.join(dir, `portal-${dia}.db`);
  if (fs.existsSync(arquivo)) return { arquivo, novo: false };

  db.exec(`VACUUM INTO '${arquivo.replaceAll("'", "''")}'`);
  // Os comprovantes têm nomes únicos e nunca mudam, então basta copiar os novos.
  if (fs.existsSync(config.uploadDir)) {
    fs.cpSync(config.uploadDir, path.join(dir, 'uploads'), { recursive: true, force: false, errorOnExist: false });
  }
  const limite = new Date(hoje.getTime() - diasRetencao * 86_400_000).toISOString().slice(0, 10);
  for (const nome of fs.readdirSync(dir)) {
    const m = nome.match(/^portal-(\d{4}-\d{2}-\d{2})\.db$/);
    if (m && m[1] < limite) fs.rmSync(path.join(dir, nome));
  }
  return { arquivo, novo: true };
}

// Uso manual: npm run backup
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(config.root, 'src/services/backup.js')) {
  const r = fazerBackup({ dir: config.backup.dir || path.join(config.root, 'data', 'backups') });
  console.log(r.novo ? `Backup criado: ${r.arquivo}` : `O backup de hoje já existe: ${r.arquivo}`);
}
