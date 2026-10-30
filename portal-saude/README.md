# Viva Bem: portal de saúde e bem-estar

Portal para os colaboradores de uma rede de supermercados. O objetivo é incentivar hábitos saudáveis e prevenir problemas causados pela rotina de trabalho, como passar o dia em pé ou fazer movimentos repetitivos no caixa.

## Como rodar

Requisitos: **Node.js 22.13 ou mais recente**. O banco é SQLite embutido no Node, então não é preciso instalar nenhum banco.

```bash
cd portal-saude
npm install
cp .env.example .env        # opcional: coloque a ANTHROPIC_API_KEY
npm run seed                # opcional: lojas, setores, cargos, recompensas e 7 colaboradores de exemplo
npm start                   # http://localhost:3000
```

O `npm start` carrega o `.env` automaticamente, se ele existir.

| Acesso | Matrícula | Senha inicial |
|---|---|---|
| RH | `rh` | `1234` |
| Colaboradores de exemplo (`npm run seed`) | `10001` a `10007` | `1234` |

No primeiro acesso, todos são obrigados a trocar a senha.

Testes: `npm test`.

## O que o sistema faz

### Configuração pelo RH
- **Setores → cargos → funções.** Cada cargo tem uma descrição da rotina e a lista de funções, com o que a pessoa faz no dia a dia.
- **Riscos do cargo:** movimentos repetitivos, carga de peso e atendimento ao público (níveis de nenhum a alto), horas em pé e sentado, frio, calor, turno noturno e as regiões do corpo mais exigidas.
- **Colaboradores:** cadastro um a um ou por **planilha (.xlsx ou .csv)** com as colunas `nome, matricula, data_nascimento, sexo, setor, cargo` (há um modelo para baixar). O sistema mostra uma **prévia** que aponta, linha a linha, os erros e dados faltantes (data inválida, sexo inválido, setor ou cargo não cadastrado, matrícula repetida) e os avisos (por exemplo, matrícula que já existe e será atualizada). Só as linhas válidas são importadas, e somente depois da confirmação do RH.
- O RH também pode redefinir a senha de um colaborador para `1234`, inativar o cadastro e ver o histórico de desafios.

### Desafios personalizados (`src/services/desafios.js` e `catalogo.js`)
O motor monta o perfil de cada pessoa com idade, sexo, IMC, nível de atividade, atividades preferidas, restrições de saúde e os riscos do cargo. Os riscos do cargo vêm do que o RH informou e também de **palavras das descrições do cargo e das funções**. Por exemplo, "câmara fria" indica frio, "scanner" indica movimento repetitivo nos punhos e "fardos" indica carga de peso. Por isso, quando o RH muda a descrição de um cargo, os próximos desafios já mudam junto. Cada cargo também guarda uma `versao`, e cada desafio registra a versão que usou.

Cada modelo do catálogo tem regras de **elegibilidade** e de **pontuação** para o perfil. O sistema escolhe os modelos com maior pontuação, com um pequeno sorteio para variar. Ele evita repetir um desafio que já está ativo e evita dar dois do mesmo grupo ao mesmo tempo. Os exames também respeitam um intervalo: por exemplo, a mamografia só volta depois de 1 ou 2 anos, conforme a idade. Cada colaborador fica com **2 desafios de atividade física e 1 de saúde preventiva** ativos (ajustável em `config.js`).

Exemplo real, com os dados de exemplo, no mesmo cargo de caixa:
- **Maria, 51 anos:** alongamento de punhos e ombros, **yoga** e **mamografia**.
- **Lucas, 21 anos:** alongamento de punhos e ombros, **corrida de 30 min** e avaliação com fisioterapeuta.

Cada desafio mostra descrição, **por que foi escolhido**, **como comprovar**, **app indicado** (Strava, ou Google Fit, Samsung Health ou Apple Saúde), **prazo** e **pontos**. Os pontos são definidos pelo sistema: um valor base por desafio e +2 quando o desafio combate um risco alto do cargo.

O catálogo de saúde preventiva inclui mamografia, preventivo do colo do útero, próstata, rastreamento colorretal, pressão arterial, glicemia, colesterol, avaliação cardiológica, ergonômica (fisioterapia ou ortopedia), oftalmologista, dentista e vacinação. Ele segue, de forma simplificada, as faixas de idade e sexo das orientações brasileiras. **Revise o catálogo com o médico do trabalho antes de usar em produção.**

### Comprovação e validação automática (`src/services/validacao.js`)
1. O colaborador envia um print (JPG, PNG, WEBP ou GIF) ou um PDF de até 10 MB. O servidor confere a assinatura real do arquivo.
2. **O mesmo arquivo já foi enviado antes**, por qualquer pessoa? Então é recusado.
3. **Metadados de imagem gerada por IA** (C2PA/IPTC `trainedAlgorithmicMedia`, Midjourney, DALL-E, Firefly…)? Então é recusado. Marcas de editores, como Photoshop ou Canva, são repassadas à IA como indício.
4. **Análise pelo Claude** (`claude-opus-5-5`, com saída em JSON estruturado). A IA lê o nome, a data, o tipo de atividade ou exame e a duração, procura sinais de geração ou edição e dá um parecer.
5. O sistema **confere de novo, por conta própria**, o período do desafio e a duração mínima, para que a aprovação não dependa só da leitura do modelo.

O comprovante fica **aprovado** ou **recusado**, sempre com o motivo. Se for recusado, o colaborador pode enviar outro enquanto o prazo estiver aberto. Se a IA não estiver configurada (sem `ANTHROPIC_API_KEY`) ou falhar, o comprovante fica **em análise**, e o RH aprova ou recusa manualmente na aba Comprovantes, onde também pode rodar a IA de novo.

### Tela "Como fazer" com vídeo e treino guiado
Cada desafio tem uma tela própria, aberta pelo botão **"Ver como fazer"** no cartão do desafio.
- **Atividade física:** a tela mostra uma **demonstração animada** de cada movimento (um boneco que executa o exercício), num **treino guiado**. O treino tem cronômetro, avança sozinho para o próximo exercício, emite um sinal sonoro na troca e tem **narração em voz** (pt-BR) das instruções. Também mostra o passo a passo com miniaturas, dicas e cuidados. A biblioteca tem 24 movimentos (alongamentos de punho e pescoço, prancha, ponte, perdigueiro, posturas de yoga, agachamento, corrida, pedalada, natação…) e fica em `public/exercicios.js`.
- **Vídeo real:** na aba **Vídeos**, o RH cola um link do YouTube, do Vimeo ou de um arquivo .mp4 para cada desafio, por exemplo um vídeo gravado com o fisioterapeuta da empresa. Com vídeo cadastrado, a tela mostra as abas "Vídeo explicativo" e "Treino guiado". Os vídeos do YouTube usam o domínio `youtube-nocookie.com`.
- **Saúde preventiva:** a tela mostra o passo a passo para agendar e fazer o exame, o preparo específico (jejum, cuidados antes da mamografia etc.) e o envio do comprovante.

### Pontos
Os pontos ficam num livro-razão (`pontos_lancamentos`): o saldo é sempre a soma dos lançamentos, e uma restrição única impede que o mesmo desafio pontue duas vezes. O colaborador vê o saldo, o histórico e os desafios concluídos.

### Pausa ativa no turno
Na aba **Pausa ativa**, o colaborador faz uma sequência de **3 a 5 minutos** de alongamentos em pé, montada a partir dos riscos do cargo dele: punhos e ombros para o caixa, lombar e pernas para a reposição, pescoço para quem fica no computador. Usa o mesmo treino guiado animado, com cronômetro e narração. Vale **1 ponto por dia**, configurável em `PAUSA_ATIVA_PONTOS`. Para pontuar, o servidor confere que a pausa durou pelo menos 80% do tempo previsto.

### Ranking por loja e por setor
A aba **Ranking** mostra a classificação do mês das lojas e dos setores pela **média de pontos por pessoa**, assim equipes pequenas e grandes competem de igual para igual. Também mostra a participação (% de pessoas que pontuaram) e destaca a loja e o setor de quem está vendo. Entram os pontos de desafios e de pausas ativas. O RH cadastra as lojas em **Lojas, setores e cargos** e vincula cada colaborador a uma loja, no cadastro ou pela coluna opcional `loja` da planilha.

### Avisos e lembretes
- **Sino no portal:** avisa sobre desafio novo, comprovante aprovado ou recusado, prazo chegando e andamento de resgates.
- **E-mail e WhatsApp:** lembretes 2 dias antes do prazo e no último dia, além do resultado dos comprovantes e dos resgates. Só recebe quem autorizou no **próprio perfil** (LGPD). Os canais ligam quando o SMTP e o Twilio são configurados no `.env` (veja o [DEPLOY.md](DEPLOY.md)).
- A verificação de prazos roda de hora em hora e nunca repete o mesmo aviso. O RH também pode dispará-la pelo painel.

### Recompensas
- **RH**, na aba Recompensas: cadastra **parceiros** e o **catálogo** (folga, vale-refeição, voucher, produto), com custo em pontos e estoque opcional. Depois acompanha os **resgates**: aprova (com código do voucher, se houver), marca como entregue ou cancela.
- **Colaborador:** vê o catálogo, o quanto falta para cada item e solicita a troca. Os pontos são debitados na hora.
- Cancelar um resgate **devolve os pontos e o estoque**. Tudo fica registrado no mesmo livro-razão de pontos (débito `resgate`, crédito `estorno`).

### Painel do RH
Por período (7, 30, 90 ou 365 dias) e por loja:
- engajamento geral e por setor (engajado é quem enviou pelo menos um comprovante no período);
- desafios cumpridos (atividade física e preventivos), pausas ativas, comprovantes recusados com o motivo e pontos distribuídos;
- ranking das lojas, situação dos canais de lembrete e alerta de resgates pendentes;
- tabela por colaborador (enviados, cumpridos, recusados, expirados, pontos e último acesso).

## Colocar no ar
O portal já vem pronto para produção com **Docker + Caddy**: HTTPS automático com Let's Encrypt, backup diário do banco e dos comprovantes, verificação de saúde e atualização do banco sem perda de dados. O passo a passo completo está no **[DEPLOY.md](DEPLOY.md)**.

## Estrutura

```
src/
  server.js          Express, segurança, rotas
  config.js          configurações (desafios, IA, pausa ativa, lembretes, backup)
  db.js              schema SQLite e migrações numeradas
  auth.js            senhas (scrypt), sessão em cookie httpOnly, permissões
  seed.js            dados de exemplo
  routes/            auth, colaborador, rh
  services/
    catalogo.js      modelos de desafio (regras de elegibilidade e pontuação)
    desafios.js      perfil, seleção e geração dos desafios
    importacao.js    leitura e conferência das planilhas
    validacao.js     validação dos comprovantes (metadados + Claude)
    pontos.js        saldo e lançamentos
    recompensas.js   catálogo, resgate, aprovação e estorno
    notificacoes.js  avisos no portal, e-mail (SMTP) e WhatsApp (Twilio) e lembretes de prazo
    pausa.js         pausa ativa por cargo
    ranking.js       ranking mensal por loja e setor
    videos.js        links de vídeo do RH (YouTube, Vimeo, MP4)
    backup.js        backup diário com retenção
public/              interface (HTML, CSS e JS, sem build); exercicios.js = movimentos animados
test/                testes (node:test)
```

## Segurança e privacidade
- Senhas com scrypt e salt. O login é bloqueado após 5 tentativas erradas. A sessão fica em cookie `httpOnly` e `SameSite=Strict`.
- Os comprovantes ficam em `data/uploads` e só podem ser vistos pelo dono e pelo RH.
- Dados de saúde são **dados pessoais sensíveis pela LGPD**. Antes de colocar em produção, defina a base legal e o termo de consentimento, a política de retenção dos comprovantes e quem no RH pode acessá-los. Também é preciso rodar o sistema atrás de HTTPS (`NODE_ENV=production` ativa o cookie `Secure`).
