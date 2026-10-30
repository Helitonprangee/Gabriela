import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root,
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? path.join(root, 'data', 'portal.db'),
  uploadDir: process.env.UPLOAD_DIR ?? path.join(root, 'data', 'uploads'),
  senhaInicial: '1234',
  sessaoHoras: 12,
  maxUploadMb: 10,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
  // Validação automática por IA: liga quando há credencial da Anthropic.
  iaHabilitada: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  // Quantidade de desafios ativos que cada colaborador mantém.
  desafiosAtivos: { atividade_fisica: 2, saude_preventiva: 1 },
  // Fase 2: troca de pontos por recompensas.
  recompensasHabilitadas: process.env.FEATURE_RECOMPENSAS === 'true',
};
