# Viva Bem: portal de saúde e bem-estar

Portal para os colaboradores de uma rede de supermercados. O objetivo é incentivar hábitos saudáveis e prevenir problemas causados pela rotina de trabalho, como passar o dia em pé ou fazer movimentos repetitivos no caixa.

## Como rodar

Requisitos: **Node.js 22.13 ou mais recente**. O banco é SQLite embutido no Node, então não é preciso instalar nenhum banco.

```bash
cd portal-saude
npm install
cp .env.example .env        # opcional: coloque a ANTHROPIC_API_KEY
npm run seed                # opcional: setores, cargos e 7 colaboradores de exemplo
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

### Painel do RH
Por período (7, 30, 90 ou 365 dias): engajamento geral e por setor (engajado é quem enviou pelo menos um comprovante no período), desafios cumpridos (atividade física e preventivos), comprovantes recusados com o motivo, pontos distribuídos e uma tabela por colaborador (enviados, cumpridos, recusados, expirados, pontos e último acesso).

## Fase 2: recompensas (estrutura pronta)
- Já existem as tabelas `parceiros`, `recompensas` (tipos: folga, vale-refeição, voucher…) e `resgates`.
- O resgate vai lançar um **débito** no mesmo livro-razão (`origem = 'resgate'`), então o saldo continua sendo a soma dos lançamentos.
- O menu mostra "Recompensas · em breve". A rota `/api/recompensas` só funciona com `FEATURE_RECOMPENSAS=true`.
- Falta implementar: o cadastro de parceiros e recompensas pelo RH, a tela de troca e o fluxo de aprovação e entrega do resgate.

## Estrutura

```
src/
  server.js          Express, segurança, rotas
  config.js          configurações (pontos por categoria, IA, fase 2)
  db.js              schema SQLite (incluindo as tabelas da fase 2)
  auth.js            senhas (scrypt), sessão em cookie httpOnly, permissões
  seed.js            dados de exemplo
  routes/            auth, colaborador, rh
  services/
    catalogo.js      modelos de desafio (regras de elegibilidade e pontuação)
    desafios.js      perfil, seleção e geração dos desafios
    importacao.js    leitura e conferência das planilhas
    validacao.js     validação dos comprovantes (metadados + Claude)
    pontos.js        saldo e lançamentos
public/              interface (HTML, CSS e JS, sem build)
test/                testes (node:test)
```

## Segurança e privacidade
- Senhas com scrypt e salt. O login é bloqueado após 5 tentativas erradas. A sessão fica em cookie `httpOnly` e `SameSite=Strict`.
- Os comprovantes ficam em `data/uploads` e só podem ser vistos pelo dono e pelo RH.
- Dados de saúde são **dados pessoais sensíveis pela LGPD**. Antes de colocar em produção, defina a base legal e o termo de consentimento, a política de retenção dos comprovantes e quem no RH pode acessá-los. Também é preciso rodar o sistema atrás de HTTPS (`NODE_ENV=production` ativa o cookie `Secure`).
