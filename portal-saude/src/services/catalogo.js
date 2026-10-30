// Catálogo de modelos de desafio. Cada modelo diz para quem é elegível (elegivel),
// quanto combina com o perfil (peso) e por quê (motivos). O motor de desafios
// pontua todos os modelos para o perfil do colaborador e escolhe os melhores.
//
// As recomendações preventivas seguem, de forma simplificada, as orientações do
// Ministério da Saúde/INCA e das sociedades médicas brasileiras. Elas incentivam a
// procura pelo serviço de saúde e não substituem a orientação do médico.

const APP_ATIVIDADE = 'Strava (ou Google Fit, Samsung Health ou Apple Saúde)';
const COMPROVA_ATIVIDADE = (min, tipo) =>
  `Registre a atividade no ${APP_ATIVIDADE} e envie um print da tela de resumo mostrando: ` +
  `o tipo de atividade (${tipo}), a duração de pelo menos ${min} minutos, a data e o seu nome no perfil do app.`;
const COMPROVA_EXAME = (exame) =>
  `Envie uma foto ou PDF do laudo, resultado ou comprovante de realização de ${exame}, ` +
  `onde apareçam o seu nome completo, o nome do exame/consulta e a data.`;

const tem = (lista, item) => lista.has(item);
const semRestricao = (p, ...codigos) => codigos.every((c) => !p.restricoes.has(c));

/** @type {Array<object>} */
export const MODELOS = [
  // ====================== ATIVIDADE FÍSICA ======================
  {
    codigo: 'corrida_30',
    categoria: 'atividade_fisica',
    grupo: 'aerobico_intenso',
    titulo: 'Corrida de 30 minutos',
    descricao: 'Faça uma corrida contínua (ou intercalada com caminhada) de pelo menos 30 minutos. Aqueça 5 minutos antes e alongue as pernas no final.',
    atividade: { aceitas: ['corrida', 'run', 'trail run', 'esteira'], duracaoMin: 30, rotulo: 'Corrida' },
    pontos: 8,
    prazoDias: 7,
    intervaloDias: 3,
    elegivel: (p) => p.idade != null && p.idade >= 16 && p.idade <= 44
      && semRestricao(p, 'impacto_articular', 'cardiaca', 'gestante')
      && (p.nivel !== 'sedentario' || p.idade < 30),
    peso: (p) => 2 + (p.idade < 30 ? 2 : 0) + (p.riscos.horas_sentado >= 4 ? 1 : 0)
      + (['moderado', 'intenso'].includes(p.nivel) ? 1 : 0) + (tem(p.preferidas, 'corrida') ? 2 : 0),
    motivos: (p) => [
      p.idade < 30 && 'sua faixa etária aproveita bem treinos aeróbicos mais intensos',
      p.riscos.horas_sentado >= 4 && 'compensa as horas que você passa sentado',
      tem(p.preferidas, 'corrida') && 'você indicou que gosta de correr',
    ],
  },
  {
    codigo: 'funcional_30',
    categoria: 'atividade_fisica',
    grupo: 'forca',
    titulo: 'Treino funcional de 30 minutos',
    descricao: 'Faça 30 minutos de treino funcional (agachamentos, pranchas, avanços, polichinelos). Pode ser em casa, seguindo um vídeo, ou na academia.',
    atividade: { aceitas: ['treino funcional', 'workout', 'treino', 'hiit', 'crossfit', 'musculacao'], duracaoMin: 30, rotulo: 'Treino / Workout' },
    pontos: 7,
    prazoDias: 7,
    intervaloDias: 3,
    elegivel: (p) => p.idade != null && p.idade >= 16 && p.idade <= 50 && semRestricao(p, 'cardiaca', 'gestante'),
    peso: (p) => 1 + (p.idade < 35 ? 1 : 0) + (p.riscos.horas_sentado >= 4 ? 1 : 0)
      + (p.riscos.carrega_peso >= 2 ? 1 : 0) + (tem(p.preferidas, 'musculacao') ? 2 : 0),
    motivos: (p) => [
      p.riscos.carrega_peso >= 2 && 'músculos fortes protegem o corpo de quem carrega peso',
      p.riscos.horas_sentado >= 4 && 'ativa o corpo depois de longos períodos sentado',
      tem(p.preferidas, 'musculacao') && 'você indicou que gosta de treinos de força',
    ],
  },
  {
    codigo: 'bicicleta_45',
    categoria: 'atividade_fisica',
    grupo: 'aerobico_moderado',
    titulo: 'Pedalada de 45 minutos',
    descricao: 'Pedale por pelo menos 45 minutos, na rua (com capacete) ou em bicicleta ergométrica.',
    atividade: { aceitas: ['ciclismo', 'pedalada', 'bike', 'ride', 'bicicleta', 'virtual ride', 'spinning'], duracaoMin: 45, rotulo: 'Pedalada / Ride' },
    pontos: 8,
    prazoDias: 7,
    intervaloDias: 3,
    elegivel: (p) => (p.idade == null || p.idade <= 60) && semRestricao(p, 'cardiaca'),
    peso: (p) => 1 + (p.idade != null && p.idade < 45 ? 1 : 0) + (p.restricoes.has('impacto_articular') ? 1 : 0)
      + (tem(p.preferidas, 'ciclismo') ? 3 : 0),
    motivos: (p) => [
      p.restricoes.has('impacto_articular') && 'é um exercício aeróbico de baixo impacto para as articulações',
      tem(p.preferidas, 'ciclismo') && 'você indicou que gosta de pedalar',
    ],
  },
  {
    codigo: 'caminhada_30',
    categoria: 'atividade_fisica',
    grupo: 'aerobico_moderado',
    titulo: 'Caminhada de 30 minutos',
    descricao: 'Caminhe em ritmo moderado (dá para conversar, mas não cantar) por pelo menos 30 minutos.',
    atividade: { aceitas: ['caminhada', 'walk', 'hike', 'trilha'], duracaoMin: 30, rotulo: 'Caminhada / Walk' },
    pontos: 5,
    prazoDias: 7,
    intervaloDias: 2,
    elegivel: () => true,
    peso: (p) => 1 + (p.idade >= 40 ? 1 : 0) + (p.nivel === 'sedentario' ? 2 : 0)
      + (p.restricoes.has('cardiaca') || p.restricoes.has('gestante') ? 2 : 0) + (tem(p.preferidas, 'caminhada') ? 2 : 0),
    motivos: (p) => [
      p.nivel === 'sedentario' && 'é a melhor forma de sair do sedentarismo com segurança',
      p.restricoes.has('cardiaca') && 'é uma atividade leve (confirme a liberação com seu médico)',
      p.restricoes.has('gestante') && 'é indicada na gestação (com liberação do seu obstetra)',
      p.riscos.ambiente_calor && 'prefira horários frescos e leve água, já que você trabalha no calor',
    ],
  },
  {
    codigo: 'yoga_30',
    categoria: 'atividade_fisica',
    grupo: 'mente_corpo',
    titulo: 'Aula de yoga de 30 minutos',
    descricao: 'Faça 30 minutos de yoga (presencial ou por vídeo). Foque na respiração e em posturas que alongam coluna, ombros e quadris.',
    atividade: { aceitas: ['yoga', 'ioga'], duracaoMin: 30, rotulo: 'Yoga' },
    pontos: 6,
    prazoDias: 7,
    intervaloDias: 3,
    elegivel: () => true,
    peso: (p) => (p.idade >= 45 ? 3 : p.idade >= 35 ? 1 : 0) + (p.riscos.atendimento_publico >= 2 ? 1 : 0)
      + (p.riscos.movimentos_repetitivos >= 2 ? 1 : 0) + (p.riscos.turno_noturno ? 1 : 0)
      + (p.restricoes.has('coluna') ? 1 : 0) + (tem(p.preferidas, 'yoga') ? 3 : 0),
    motivos: (p) => [
      p.idade >= 45 && 'melhora a flexibilidade e o equilíbrio, que pedem mais cuidado a partir dos 45 anos',
      p.riscos.atendimento_publico >= 2 && 'ajuda a aliviar o estresse do atendimento ao público',
      p.riscos.movimentos_repetitivos >= 2 && 'alonga as regiões sobrecarregadas pelos movimentos repetitivos',
      p.riscos.turno_noturno && 'favorece o relaxamento e o sono de quem trabalha à noite',
      tem(p.preferidas, 'yoga') && 'você indicou que gosta de yoga',
    ],
  },
  {
    codigo: 'pilates_40',
    categoria: 'atividade_fisica',
    grupo: 'mente_corpo',
    titulo: 'Sessão de pilates de 40 minutos',
    descricao: 'Faça uma sessão de pilates (solo ou aparelhos) de pelo menos 40 minutos, com foco no fortalecimento do abdômen e da lombar.',
    atividade: { aceitas: ['pilates'], duracaoMin: 40, rotulo: 'Pilates' },
    pontos: 7,
    prazoDias: 7,
    intervaloDias: 3,
    elegivel: () => true,
    peso: (p) => (p.idade >= 45 ? 3 : 0) + (p.restricoes.has('coluna') ? 2 : 0) + (p.riscos.carrega_peso >= 2 ? 2 : 0)
      + (p.riscos.horas_em_pe >= 6 ? 1 : 0) + (tem(p.preferidas, 'pilates') ? 3 : 0),
    motivos: (p) => [
      p.idade >= 45 && 'fortalece a musculatura que sustenta a coluna, essencial a partir dos 45 anos',
      p.restricoes.has('coluna') && 'é indicado para quem tem queixas na coluna',
      p.riscos.carrega_peso >= 2 && 'protege a lombar de quem carrega peso no trabalho',
      p.riscos.horas_em_pe >= 6 && 'melhora a postura de quem passa o dia em pé',
      tem(p.preferidas, 'pilates') && 'você indicou que gosta de pilates',
    ],
  },
  {
    codigo: 'natacao_40',
    categoria: 'atividade_fisica',
    grupo: 'aerobico_moderado',
    titulo: 'Natação ou hidroginástica de 40 minutos',
    descricao: 'Nade ou faça hidroginástica por pelo menos 40 minutos. A água reduz o impacto nas articulações.',
    atividade: { aceitas: ['natacao', 'swim', 'hidroginastica', 'nado'], duracaoMin: 40, rotulo: 'Natação / Swim' },
    pontos: 8,
    prazoDias: 10,
    intervaloDias: 3,
    elegivel: (p) => (p.idade != null && p.idade >= 50) || p.restricoes.has('impacto_articular') || tem(p.preferidas, 'natacao'),
    peso: (p) => (p.idade >= 55 ? 3 : p.idade >= 50 ? 2 : 0) + (p.restricoes.has('impacto_articular') ? 3 : 0)
      + (tem(p.preferidas, 'natacao') ? 3 : 0),
    motivos: (p) => [
      p.idade >= 50 && 'trabalha o corpo todo sem sobrecarregar as articulações',
      p.restricoes.has('impacto_articular') && 'é uma opção sem impacto, adequada à sua restrição',
      tem(p.preferidas, 'natacao') && 'você indicou que gosta de atividades na água',
    ],
  },
  {
    codigo: 'danca_30',
    categoria: 'atividade_fisica',
    grupo: 'aerobico_moderado',
    titulo: 'Dança de 30 minutos',
    descricao: 'Dance por 30 minutos: aula de dança, zumba ou seguindo um vídeo em casa.',
    atividade: { aceitas: ['danca', 'zumba', 'dance'], duracaoMin: 30, rotulo: 'Dança / Workout' },
    pontos: 6,
    prazoDias: 7,
    intervaloDias: 3,
    elegivel: (p) => semRestricao(p, 'cardiaca'),
    peso: (p) => 1 + (p.riscos.atendimento_publico >= 2 ? 1 : 0) + (tem(p.preferidas, 'danca') ? 3 : 0),
    motivos: (p) => [
      p.riscos.atendimento_publico >= 2 && 'é uma forma divertida de descarregar o estresse do dia',
      tem(p.preferidas, 'danca') && 'você indicou que gosta de dançar',
    ],
  },
  {
    codigo: 'alongamento_membros_superiores_15',
    categoria: 'atividade_fisica',
    grupo: 'ergonomico_superior',
    titulo: 'Alongamento de punhos, mãos e ombros (15 min)',
    descricao: 'Faça 15 minutos de alongamento de dedos, punhos, antebraços, ombros e pescoço. Segure cada posição por 20 a 30 segundos, sem dor.',
    atividade: { aceitas: ['alongamento', 'yoga', 'workout', 'treino', 'mobilidade', 'stretching'], duracaoMin: 15, rotulo: 'Alongamento / Workout' },
    pontos: 5,
    prazoDias: 5,
    intervaloDias: 2,
    elegivel: (p) => p.riscos.movimentos_repetitivos >= 1 || tem(p.regioes, 'punhos') || tem(p.regioes, 'ombros'),
    peso: (p) => p.riscos.movimentos_repetitivos * 1.5 + (tem(p.regioes, 'punhos') ? 1 : 0)
      + (tem(p.regioes, 'ombros') || tem(p.regioes, 'pescoco') ? 1 : 0) + (p.riscos.ambiente_frio ? 1 : 0),
    motivos: (p) => [
      p.riscos.movimentos_repetitivos >= 2 && 'seu cargo envolve movimentos repetitivos com as mãos e os braços',
      tem(p.regioes, 'punhos') && 'previne tendinites e LER/DORT nos punhos',
      p.riscos.ambiente_frio && 'o frio deixa a musculatura mais rígida e propensa a lesões',
    ],
  },
  {
    codigo: 'circulacao_pernas_20',
    categoria: 'atividade_fisica',
    grupo: 'ergonomico_inferior',
    titulo: 'Circulação das pernas: caminhada leve + alongamento (20 min)',
    descricao: 'Faça 20 minutos de caminhada leve seguida de alongamento de panturrilhas e coxas. Ao terminar, descanse 10 minutos com as pernas elevadas.',
    atividade: { aceitas: ['caminhada', 'walk', 'alongamento', 'workout'], duracaoMin: 20, rotulo: 'Caminhada / Walk' },
    pontos: 5,
    prazoDias: 5,
    intervaloDias: 2,
    elegivel: (p) => p.riscos.horas_em_pe >= 4 || tem(p.regioes, 'pernas'),
    peso: (p) => (p.riscos.horas_em_pe >= 6 ? 4 : p.riscos.horas_em_pe >= 4 ? 2 : 0) + (tem(p.regioes, 'pernas') ? 1 : 0)
      + (p.idade >= 40 ? 1 : 0),
    motivos: (p) => [
      p.riscos.horas_em_pe >= 6 && `você passa cerca de ${p.riscos.horas_em_pe} horas por dia em pé`,
      'ativa a circulação e previne varizes, inchaço e dores nas pernas',
    ],
  },
  {
    codigo: 'fortalecimento_lombar_20',
    categoria: 'atividade_fisica',
    grupo: 'ergonomico_coluna',
    titulo: 'Fortalecimento de abdômen e lombar (20 min)',
    descricao: 'Faça 20 minutos de exercícios de fortalecimento do core: pranchas, ponte de glúteo, "perdigueiro" (bird-dog) e abdominal hipopressivo.',
    atividade: { aceitas: ['workout', 'treino', 'treino funcional', 'pilates', 'musculacao', 'fortalecimento'], duracaoMin: 20, rotulo: 'Treino / Workout' },
    pontos: 6,
    prazoDias: 7,
    intervaloDias: 2,
    elegivel: (p) => (p.riscos.carrega_peso >= 1 || tem(p.regioes, 'coluna')) && semRestricao(p, 'gestante'),
    peso: (p) => p.riscos.carrega_peso * 2 + (tem(p.regioes, 'coluna') ? 1 : 0),
    motivos: (p) => [
      p.riscos.carrega_peso >= 2 && 'seu cargo envolve carregar peso, e um core forte protege a coluna',
      tem(p.regioes, 'coluna') && 'a coluna é uma das regiões mais exigidas na sua rotina',
    ],
  },

  // ====================== SAÚDE PREVENTIVA ======================
  {
    codigo: 'mamografia',
    categoria: 'saude_preventiva',
    titulo: 'Mamografia (prevenção do câncer de mama)',
    descricao: 'Agende e realize a mamografia de rastreamento. Ela está disponível pelo SUS e pelos planos de saúde. Leve o pedido médico, se o local pedir.',
    exame: { aceitos: ['mamografia', 'mamografia bilateral', 'mamografia de rastreamento'], rotulo: 'mamografia' },
    pontos: 20,
    prazoDias: 60,
    intervaloDias: (p) => (p.idade >= 50 ? 730 : 365),
    elegivel: (p) => p.sexo === 'F' && p.idade >= 40,
    peso: (p) => 5 + (p.idade >= 50 ? 1 : 0),
    motivos: (p) => [p.idade >= 50
      ? 'mulheres de 50 a 74 anos devem fazer mamografia a cada 2 anos'
      : 'a partir dos 40 anos a mamografia pode ser feita após conversa com o médico'],
  },
  {
    codigo: 'papanicolau',
    categoria: 'saude_preventiva',
    titulo: 'Exame preventivo do colo do útero',
    descricao: 'Realize o exame preventivo (Papanicolau ou teste de DNA-HPV) em uma UBS ou com seu ginecologista.',
    exame: { aceitos: ['papanicolau', 'citopatologico', 'preventivo', 'colpocitologia', 'dna-hpv', 'teste de hpv'], rotulo: 'exame preventivo do colo do útero' },
    pontos: 20,
    prazoDias: 60,
    intervaloDias: 1095,
    elegivel: (p) => p.sexo === 'F' && p.idade >= 25 && p.idade <= 64,
    peso: () => 5,
    motivos: () => ['é recomendado para mulheres de 25 a 64 anos e detecta alterações antes de virarem câncer'],
  },
  {
    codigo: 'saude_prostata',
    categoria: 'saude_preventiva',
    titulo: 'Consulta com urologista (saúde da próstata)',
    descricao: 'Agende uma consulta com o urologista para conversar sobre a saúde da próstata e decidir, junto com o médico, quais exames fazer.',
    exame: { aceitos: ['consulta urologica', 'urologista', 'psa', 'antigeno prostatico', 'toque retal'], rotulo: 'consulta urológica ou exame de PSA' },
    pontos: 20,
    prazoDias: 60,
    intervaloDias: 365,
    elegivel: (p) => p.sexo === 'M' && p.idade >= 50,
    peso: () => 5,
    motivos: () => ['a partir dos 50 anos o acompanhamento da próstata deve ser conversado com o urologista'],
  },
  {
    codigo: 'rastreamento_colorretal',
    categoria: 'saude_preventiva',
    titulo: 'Pesquisa de sangue oculto nas fezes',
    descricao: 'Peça ao seu médico o exame de pesquisa de sangue oculto nas fezes, que ajuda na prevenção do câncer de intestino.',
    exame: { aceitos: ['sangue oculto', 'pesquisa de sangue oculto', 'colonoscopia', 'fit'], rotulo: 'pesquisa de sangue oculto nas fezes ou colonoscopia' },
    pontos: 20,
    prazoDias: 60,
    intervaloDias: 365,
    elegivel: (p) => p.idade >= 50 && p.idade <= 75,
    peso: () => 4,
    motivos: () => ['o rastreamento do câncer colorretal é recomendado dos 50 aos 75 anos'],
  },
  {
    codigo: 'avaliacao_cardiologica',
    categoria: 'saude_preventiva',
    titulo: 'Avaliação cardiológica',
    descricao: 'Faça uma consulta com o cardiologista, com eletrocardiograma, para acompanhar a saúde do coração e saber quais atividades físicas são seguras para você.',
    exame: { aceitos: ['cardiologista', 'eletrocardiograma', 'ecg', 'teste ergometrico', 'consulta cardiologica'], rotulo: 'consulta cardiológica ou eletrocardiograma' },
    pontos: 15,
    prazoDias: 60,
    intervaloDias: 365,
    elegivel: (p) => p.idade >= 45 || p.restricoes.has('cardiaca'),
    peso: (p) => (p.restricoes.has('cardiaca') ? 5 : 2) + (p.idade >= 55 ? 1 : 0),
    motivos: (p) => [
      p.restricoes.has('cardiaca') && 'você informou uma condição cardíaca no seu perfil',
      p.idade >= 45 && 'a partir dos 45 anos é importante avaliar o coração antes de intensificar os exercícios',
    ],
  },
  {
    codigo: 'avaliacao_ergonomica',
    categoria: 'saude_preventiva',
    titulo: 'Avaliação com fisioterapeuta ou ortopedista',
    descricao: 'Agende uma avaliação com fisioterapeuta ou ortopedista para checar as regiões mais exigidas pelo seu trabalho e receber orientações de prevenção.',
    exame: { aceitos: ['fisioterapia', 'fisioterapeuta', 'ortopedista', 'avaliacao postural', 'consulta ortopedica'], rotulo: 'consulta com fisioterapeuta ou ortopedista' },
    pontos: 15,
    prazoDias: 60,
    intervaloDias: 365,
    elegivel: (p) => p.riscos.movimentos_repetitivos >= 2 || p.riscos.carrega_peso >= 2 || p.restricoes.has('coluna'),
    peso: (p) => 1 + Math.max(p.riscos.movimentos_repetitivos, p.riscos.carrega_peso) + (p.restricoes.has('coluna') ? 1 : 0),
    motivos: (p) => [
      p.riscos.movimentos_repetitivos >= 2 && 'ajuda a detectar cedo sinais de LER/DORT causados por movimentos repetitivos',
      p.riscos.carrega_peso >= 2 && 'ajuda a prevenir lesões na coluna de quem carrega peso',
      p.restricoes.has('coluna') && 'permite acompanhar a queixa na coluna que você informou',
    ],
  },
  {
    codigo: 'pressao_arterial',
    categoria: 'saude_preventiva',
    titulo: 'Aferição da pressão arterial',
    descricao: 'Meça a pressão arterial em uma UBS, farmácia ou consulta médica e guarde o registro.',
    exame: { aceitos: ['pressao arterial', 'afericao de pressao', 'mapa', 'consulta medica'], rotulo: 'registro de aferição da pressão arterial' },
    pontos: 10,
    prazoDias: 30,
    intervaloDias: 365,
    elegivel: (p) => p.idade == null || p.idade >= 18,
    peso: (p) => 2 + (p.idade >= 40 ? 1 : 0) + (p.imc >= 30 ? 1 : 0),
    motivos: (p) => [
      'a hipertensão costuma não dar sintomas e deve ser medida pelo menos uma vez por ano',
      p.riscos.atendimento_publico >= 2 && 'o estresse do dia a dia pode elevar a pressão',
    ],
  },
  {
    codigo: 'glicemia',
    categoria: 'saude_preventiva',
    titulo: 'Exame de glicemia (diabetes)',
    descricao: 'Faça um exame de glicemia de jejum ou hemoglobina glicada (pedido médico ou campanha de saúde).',
    exame: { aceitos: ['glicemia', 'glicose', 'hemoglobina glicada', 'hba1c'], rotulo: 'exame de glicemia ou hemoglobina glicada' },
    pontos: 15,
    prazoDias: 60,
    intervaloDias: 365,
    elegivel: (p) => p.idade >= 35 || p.imc >= 25,
    peso: (p) => 2 + (p.imc >= 25 ? 2 : 0) + (p.nivel === 'sedentario' ? 1 : 0),
    motivos: (p) => [
      p.idade >= 35 && 'o rastreamento de diabetes é recomendado a partir dos 35 anos',
      p.imc >= 25 && 'o IMC informado no seu perfil aumenta o risco de diabetes',
    ],
  },
  {
    codigo: 'colesterol',
    categoria: 'saude_preventiva',
    titulo: 'Exame de colesterol (perfil lipídico)',
    descricao: 'Faça o exame de perfil lipídico (colesterol total, HDL, LDL e triglicerídeos).',
    exame: { aceitos: ['colesterol', 'perfil lipidico', 'lipidograma', 'triglicerides', 'triglicerideos'], rotulo: 'exame de colesterol / perfil lipídico' },
    pontos: 15,
    prazoDias: 60,
    intervaloDias: 730,
    elegivel: (p) => p.idade >= 30 || p.imc >= 25,
    peso: (p) => 2 + (p.idade >= 45 ? 1 : 0) + (p.imc >= 25 ? 1 : 0),
    motivos: () => ['o colesterol alto não dá sintomas e é um dos principais fatores de risco do coração'],
  },
  {
    codigo: 'oftalmologista',
    categoria: 'saude_preventiva',
    titulo: 'Consulta com oftalmologista',
    descricao: 'Faça uma consulta oftalmológica para checar a visão e a pressão dos olhos.',
    exame: { aceitos: ['oftalmologista', 'consulta oftalmologica', 'exame de vista', 'tonometria', 'receita de oculos'], rotulo: 'consulta oftalmológica' },
    pontos: 15,
    prazoDias: 60,
    intervaloDias: 730,
    elegivel: (p) => p.idade >= 40 || p.riscos.horas_sentado >= 6,
    peso: (p) => 1 + (p.idade >= 40 ? 1 : 0) + (p.riscos.horas_sentado >= 6 ? 1 : 0),
    motivos: (p) => [
      p.idade >= 40 && 'a partir dos 40 anos aumentam a vista cansada e o risco de glaucoma',
      p.riscos.horas_sentado >= 6 && 'você passa muitas horas em frente a telas',
    ],
  },
  {
    codigo: 'dentista',
    categoria: 'saude_preventiva',
    titulo: 'Consulta odontológica',
    descricao: 'Vá ao dentista para uma revisão e limpeza.',
    exame: { aceitos: ['dentista', 'odontologica', 'odontologico', 'limpeza dental', 'profilaxia'], rotulo: 'consulta odontológica' },
    pontos: 10,
    prazoDias: 45,
    intervaloDias: 180,
    elegivel: () => true,
    peso: () => 1,
    motivos: () => ['a revisão odontológica é recomendada a cada 6 meses'],
  },
  {
    codigo: 'vacinacao',
    categoria: 'saude_preventiva',
    titulo: 'Cartão de vacinação em dia',
    descricao: 'Vá a uma UBS para conferir e atualizar seu cartão de vacinação (gripe, tétano, hepatite B, entre outras).',
    exame: { aceitos: ['vacina', 'vacinacao', 'cartao de vacina', 'carteira de vacinacao', 'imunizacao'], rotulo: 'cartão de vacinação atualizado' },
    pontos: 10,
    prazoDias: 45,
    intervaloDias: 365,
    elegivel: () => true,
    peso: (p) => 1 + (p.idade >= 60 ? 2 : 0) + (p.riscos.atendimento_publico >= 2 ? 1 : 0) + (p.riscos.ambiente_frio ? 1 : 0),
    motivos: (p) => [
      p.idade >= 60 && 'a partir dos 60 anos a vacina da gripe é anual e fundamental',
      p.riscos.atendimento_publico >= 2 && 'você tem contato diário com muitas pessoas',
      p.riscos.ambiente_frio && 'quem trabalha no frio fica mais exposto a gripes e resfriados',
    ],
  },
];

export const comoComprovar = (modelo) => (modelo.categoria === 'atividade_fisica'
  ? COMPROVA_ATIVIDADE(modelo.atividade.duracaoMin, modelo.atividade.rotulo)
  : COMPROVA_EXAME(modelo.exame.rotulo));

export const appSugerido = (modelo) => (modelo.categoria === 'atividade_fisica' ? APP_ATIVIDADE : null);

export const intervaloDe = (modelo, perfil) =>
  (typeof modelo.intervaloDias === 'function' ? modelo.intervaloDias(perfil) : modelo.intervaloDias);
