# Colocar o Viva Bem no ar

Guia para instalar o portal num servidor da empresa (ou numa VPS) com **HTTPS automático** e **backup diário**.

## O que você precisa
- Um servidor Linux com **Docker** e **Docker Compose** (2 GB de RAM bastam para centenas de colaboradores).
- Um **domínio ou subdomínio**, por exemplo `saude.suaempresa.com.br`, com um registro DNS do tipo A apontando para o IP do servidor.
- As portas **80 e 443** liberadas no firewall (o certificado HTTPS é emitido automaticamente pelo Let's Encrypt).
- Opcional: chave da API da Anthropic (validação automática dos comprovantes), dados de SMTP (lembretes por e-mail) e uma conta Twilio com WhatsApp Business (lembretes por WhatsApp).

## Instalação
```bash
git clone https://github.com/Helitonprangee/Gabriela.git
cd Gabriela/portal-saude
cp .env.example .env
nano .env            # preencha DOMINIO, ANTHROPIC_API_KEY e, se quiser, SMTP/Twilio
docker compose up -d --build
```
Em um ou dois minutos o portal estará em `https://SEU_DOMINIO`.

**Primeiro acesso do RH:** matrícula `rh`, senha `1234`. O sistema exige a troca da senha imediatamente. Faça isso logo após subir o portal.

Para carregar os dados de demonstração (não use em produção real): `docker compose exec portal node src/seed.js`.

## O que roda sozinho
| Rotina | Quando |
|---|---|
| Lembretes de prazo (2 dias antes e no último dia) | a cada hora |
| Backup do banco e dos comprovantes em `./backups` | uma vez por dia, a partir das 2h |
| Remoção de backups com mais de `BACKUP_DIAS` dias | junto com o backup |
| Renovação do certificado HTTPS | automática (Caddy) |

Verifique a saúde do sistema em `https://SEU_DOMINIO/api/saude` ou com `docker compose ps` (coluna STATUS = `healthy`).

## Backups
- Os arquivos ficam na pasta `backups/` do servidor: `portal-AAAA-MM-DD.db` (banco) e `uploads/` (comprovantes).
- **Copie essa pasta para fora do servidor** (outro servidor, nuvem, NAS). Exemplo com `rsync` agendado no cron do servidor:
  ```
  30 3 * * * rsync -a /caminho/Gabriela/portal-saude/backups/ usuario@servidor-backup:/backups/viva-bem/
  ```
- Backup manual a qualquer momento: `docker compose exec portal node src/services/backup.js`.

### Restaurar um backup
```bash
docker compose stop portal
docker compose run --rm --no-deps portal sh -c \
  "rm -f /dados/portal.db-wal /dados/portal.db-shm && cp /backups/portal-2026-11-10.db /dados/portal.db && cp -r /backups/uploads/. /dados/uploads/"
docker compose start portal
```

## Atualizar para uma nova versão
```bash
git pull
docker compose up -d --build
```
O banco é atualizado automaticamente na inicialização (migrações numeradas). Os dados são preservados.

## Lembretes por e-mail e WhatsApp
- **E-mail:** preencha `SMTP_URL`, por exemplo `smtps://usuario:senha@smtp.suaempresa.com.br:465`, e `EMAIL_REMETENTE`.
- **WhatsApp:** preencha `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_WHATSAPP_FROM` (`whatsapp:+55...`). Atenção: pelas regras do WhatsApp, mensagens iniciadas pela empresa fora de uma conversa aberta precisam de um **modelo de mensagem aprovado** no Twilio/Meta. Cadastre um modelo de lembrete antes de ativar o canal em produção.
- Só recebe e-mail ou WhatsApp quem **marcou a autorização no próprio perfil** (LGPD). Todos recebem os avisos no sino do portal.
- O painel do RH mostra quais canais estão configurados e tem um botão para disparar a verificação de prazos na hora.

## Segurança e LGPD (checklist antes de liberar para os colaboradores)
- [ ] Senha do usuário `rh` trocada.
- [ ] Termo de consentimento para tratamento de dados de saúde aprovado pelo jurídico e comunicado aos colaboradores.
- [ ] Definido quem no RH pode ver os comprovantes e por quanto tempo eles serão guardados.
- [ ] Backups copiados para fora do servidor e restauração testada pelo menos uma vez.
- [ ] Catálogo de exames preventivos revisado pelo médico do trabalho.
- [ ] Servidor com atualizações automáticas de segurança do sistema operacional.
