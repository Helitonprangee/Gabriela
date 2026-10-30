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
  // Troca de pontos por recompensas (pode ser desligada com FEATURE_RECOMPENSAS=false).
  recompensasHabilitadas: process.env.FEATURE_RECOMPENSAS !== 'false',
  // Pausa ativa: pontos por pausa concluída, no máximo uma vez por dia.
  pausaAtiva: { pontos: Number(process.env.PAUSA_ATIVA_PONTOS ?? 1), limitePorDia: 1 },
  // Lembretes: dias antes do prazo para avisar.
  lembreteDiasAntes: 2,
  urlPublica: process.env.URL_PUBLICA ?? `http://localhost:${process.env.PORT ?? 3000}`,
  email: {
    smtpUrl: process.env.SMTP_URL ?? '',              // ex.: smtps://usuario:senha@smtp.empresa.com.br:465
    remetente: process.env.EMAIL_REMETENTE ?? 'Viva Bem <nao-responda@empresa.com.br>',
  },
  whatsapp: {
    // Envio pela API do Twilio (WhatsApp Business). Sem as três variáveis, o canal fica desligado.
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    remetente: process.env.TWILIO_WHATSAPP_FROM ?? '',  // ex.: whatsapp:+5511999999999
  },
  backup: { dir: process.env.BACKUP_DIR ?? '', diasRetencao: Number(process.env.BACKUP_DIAS ?? 14) },
};
