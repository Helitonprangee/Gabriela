// Biblioteca de movimentos animados e guias "como fazer" de cada desafio.
// Cada movimento é uma sequência de poses de um boneco visto de lado (olhando para a direita).
// Ângulos em graus, no referencial da tela: 0 = para baixo, 90 = para a frente, 180 = para cima, -90 = para trás.

const L = { lombar: 25, peito: 27, pescoco: 6, cabeca: 10, braco: 27, antebraco: 25, mao: 9, coxa: 35, canela: 34, pe: 11 };
const CHAO = 180;

const EM_PE = {
  x: 100, y: 111, lombar: 180, peito: null, cabeca: null,
  bE: -6, aE: -6, mE: null, bD: 6, aD: 6, mD: null,
  cE: -3, kE: -3, pE: null, cD: 3, kD: 3, pD: null,
};
const pose = (p) => ({ ...EM_PE, ...p });
const DEITADO = { x: 110, y: 170, lombar: -90, peito: -90, cabeca: -90, bE: 88, aE: 90, bD: 88, aD: 90 };
const QUATRO_APOIOS = { x: 75, y: 146, lombar: 114, peito: 114, cabeca: 100, bE: 2, aE: 0, mE: 90, bD: -2, aD: 0, mD: 90, cE: 0, kE: -90, pE: -90, cD: 0, kD: -90, pD: -90 };

const rad = (g) => (g * Math.PI) / 180;
const dir = (g, l) => [Math.sin(rad(g)) * l, Math.cos(rad(g)) * l];
const graus = (dx, dy) => (Math.atan2(dx, dy) * 180) / Math.PI;

/** Ângulos de coxa e canela para o tornozelo alcançar (ax, ay), com o joelho para a frente. */
function perna(hx, hy, ax, ay) {
  const dx = ax - hx, dy = ay - hy;
  const d = Math.min(Math.hypot(dx, dy), L.coxa + L.canela - 0.01);
  const alfa = Math.acos((L.coxa ** 2 + d ** 2 - L.canela ** 2) / (2 * L.coxa * d)) * 180 / Math.PI;
  const coxa = graus(dx, dy) + alfa;
  const [kx, ky] = dir(coxa, L.coxa);
  return [coxa, graus(ax - hx - kx, ay - hy - ky)];
}

function pedalada(fase) {
  const hx = 96, hy = 104;
  const lado = (f) => {
    const a = f * 2 * Math.PI;
    const [cx, cy] = [104 + Math.sin(a) * 13, 158 - Math.cos(a) * 13];
    const [c, k] = perna(hx, hy, cx - 4, cy - 4);
    return { c, k, p: 100 };
  };
  const d = lado(fase), e = lado(fase + 0.5);
  return pose({
    x: hx, y: hy, lombar: 145, peito: 135, cabeca: 160,
    bD: 35, aD: 75, bE: 32, aE: 72, cD: d.c, kD: d.k, pD: d.p, cE: e.c, kE: e.k, pE: e.p,
  });
}

// ---------------- Movimentos ----------------
// quadros: [{ p: pose, d: segundos de transição até esta pose, h: segundos parado nela }]

export const MOVIMENTOS = {
  respiracao: {
    nome: 'Respiração com elevação dos braços',
    instrucao: 'Em pé, inspire pelo nariz enquanto sobe os braços pela frente até o alto. Solte o ar pela boca enquanto desce os braços devagar.',
    quadros: [
      { p: pose({}), d: 3, h: 0.5 },
      { p: pose({ bD: 90, aD: 90, bE: 85, aE: 85 }), d: 1.5 },
      { p: pose({ bD: 178, aD: 178, bE: 175, aE: 175, cabeca: 175 }), d: 1.5, h: 1 },
      { p: pose({ bD: 90, aD: 90, bE: 85, aE: 85 }), d: 1.5 },
    ],
  },
  circulos_bracos: {
    nome: 'Círculos com os braços',
    instrucao: 'Braços esticados, faça círculos grandes e lentos para trás. Depois de metade do tempo, inverta o sentido.',
    quadros: [
      { p: pose({ bD: 0, aD: 0, bE: 180, aE: 180 }), d: 0.8 },
      { p: pose({ bD: -90, aD: -90, bE: 90, aE: 90 }), d: 0.8 },
      { p: pose({ bD: 180, aD: 180, bE: 0, aE: 0 }), d: 0.8 },
      { p: pose({ bD: 90, aD: 90, bE: -90, aE: -90 }), d: 0.8 },
    ],
  },
  flexao_pescoco: {
    nome: 'Alongamento do pescoço',
    instrucao: 'Leve o queixo em direção ao peito e segure 20 segundos sentindo a nuca alongar. Volte devagar. Depois incline a cabeça para cada lado.',
    quadros: [
      { p: pose({}), d: 1.5, h: 1 },
      { p: pose({ cabeca: 140, peito: 175 }), d: 2, h: 3 },
    ],
  },
  extensao_punho: {
    nome: 'Alongamento do antebraço (punho para cima)',
    instrucao: 'Estique um braço à frente com a palma virada para fora e os dedos para cima. Com a outra mão, puxe os dedos para trás com suavidade. Segure 20 a 30 segundos e troque de braço.',
    quadros: [
      { p: pose({}), d: 1.5, h: 0.5 },
      { p: pose({ bD: 90, aD: 90, mD: 180, bE: 62, aE: 112, mE: 150 }), d: 1.5, h: 3 },
    ],
  },
  flexao_punho: {
    nome: 'Alongamento do antebraço (punho para baixo)',
    instrucao: 'Estique um braço à frente com os dedos apontando para baixo. Com a outra mão, empurre o dorso da mão em direção ao corpo. Segure 20 a 30 segundos e troque de braço.',
    quadros: [
      { p: pose({}), d: 1.5, h: 0.5 },
      { p: pose({ bD: 90, aD: 90, mD: 0, bE: 62, aE: 105, mE: 40 }), d: 1.5, h: 3 },
    ],
  },
  caminhada: {
    nome: 'Caminhada',
    instrucao: 'Caminhe em ritmo confortável, com a postura ereta e os braços balançando ao lado do corpo. Você deve conseguir conversar, mas não cantar.',
    quadros: [
      { p: pose({ y: 109, cD: 24, kD: 8, cE: -18, kE: -38, bD: -22, aD: -8, bE: 20, aE: 38 }), d: 0.55 },
      { p: pose({ y: 109, cE: 24, kE: 8, cD: -18, kD: -38, bE: -22, aE: -8, bD: 20, aD: 38 }), d: 0.55 },
    ],
  },
  corrida: {
    nome: 'Corrida',
    instrucao: 'Corra em ritmo constante, com passadas curtas, tronco levemente inclinado à frente e cotovelos dobrados. Respire de forma ritmada.',
    quadros: [
      { p: pose({ y: 107, lombar: 172, cD: 45, kD: 8, cE: -28, kE: -78, bD: -40, aD: 40, bE: 40, aE: 125 }), d: 0.35 },
      { p: pose({ y: 107, lombar: 172, cE: 45, kE: 8, cD: -28, kD: -78, bE: -40, aE: 40, bD: 40, aD: 125 }), d: 0.35 },
    ],
  },
  marcha: {
    nome: 'Marcha no lugar (aquecimento)',
    instrucao: 'Marche no lugar elevando bem os joelhos e balançando os braços. Aumente o ritmo aos poucos para aquecer.',
    quadros: [
      { p: pose({ cD: 78, kD: 0, bE: 35, aE: 100, bD: -15, aD: 50 }), d: 0.5 },
      { p: pose({ cE: 78, kE: 0, bD: 35, aD: 100, bE: -15, aE: 50 }), d: 0.5 },
    ],
  },
  panturrilha: {
    nome: 'Elevação dos calcanhares',
    instrucao: 'Em pé, apoiado se precisar, suba na ponta dos pés devagar, segure 2 segundos e desça. Ativa a circulação das pernas.',
    quadros: [
      { p: pose({ pD: 92, pE: 92 }), d: 1.2, h: 0.4 },
      { p: pose({ y: 103, pD: 28, pE: 28 }), d: 1.2, h: 1.2 },
    ],
  },
  alongamento_panturrilha: {
    nome: 'Alongamento da panturrilha na parede',
    instrucao: 'De frente para a parede, apoie as mãos, dê um passo à frente e mantenha a perna de trás esticada com o calcanhar no chão. Segure 30 segundos e troque de perna.',
    cenario: ['parede'],
    quadros: [
      { p: pose({ x: 96, y: 117, lombar: 162, cabeca: 168, cD: 30, kD: -6, cE: -25, kE: -25, pE: 65, bD: 82, aD: 92, mD: 175, bE: 80, aE: 90, mE: 175 }), d: 1.5, h: 2 },
      { p: pose({ x: 98, y: 118, lombar: 154, cabeca: 162, cD: 34, kD: -6, cE: -27, kE: -27, pE: 63, bD: 80, aD: 98, mD: 175, bE: 78, aE: 96, mE: 175 }), d: 1.5, h: 2 },
    ],
  },
  alongamento_quadriceps: {
    nome: 'Alongamento da coxa',
    instrucao: 'Apoiado na parede ou numa bancada, dobre um joelho e segure o pé atrás com a mão, aproximando o calcanhar do bumbum. Joelhos alinhados. Segure 30 segundos e troque.',
    quadros: [
      { p: pose({}), d: 1.5, h: 0.5 },
      { p: pose({ cD: -6, kD: 172, pD: 230, bD: -12, aD: 6, bE: 60, aE: 80 }), d: 1.5, h: 3 },
    ],
  },
  pernas_elevadas: {
    nome: 'Pernas elevadas na parede',
    instrucao: 'Deite de barriga para cima perto de uma parede e apoie as pernas esticadas nela. Respire fundo e relaxe. Alivia o inchaço de quem fica muito tempo em pé.',
    cenario: ['parede_baixa'],
    quadros: [
      { p: { ...DEITADO, cD: 178, kD: 178, pD: 268, cE: 176, kE: 176, pE: 266 }, d: 2.5, h: 1 },
      { p: { ...DEITADO, peito: -87, cD: 178, kD: 178, pD: 268, cE: 176, kE: 176, pE: 266 }, d: 2.5, h: 1 },
    ],
  },
  prancha: {
    nome: 'Prancha',
    instrucao: 'Apoie antebraços e pontas dos pés no chão, com o corpo em linha reta da cabeça aos calcanhares. Contraia o abdômen e não deixe o quadril cair. Segure de 20 a 30 segundos.',
    cenario: ['tapete'],
    quadros: [
      { p: pose({ x: 85, y: 160, lombar: 100, cabeca: 104, bD: 0, aD: 90, mD: 90, bE: 0, aE: 90, mE: 90, cD: -80, kD: -80, pD: 0, cE: -80, kE: -80, pE: 0 }), d: 2, h: 0.5 },
      { p: pose({ x: 85, y: 159, lombar: 99, cabeca: 103, bD: 0, aD: 90, mD: 90, bE: 0, aE: 90, mE: 90, cD: -81, kD: -81, pD: 0, cE: -81, kE: -81, pE: 0 }), d: 2, h: 0.5 },
    ],
  },
  ponte: {
    nome: 'Ponte de glúteo',
    instrucao: 'Deitado de barriga para cima, joelhos dobrados e pés no chão. Contraia glúteos e abdômen e suba o quadril até alinhar com os joelhos. Segure 2 segundos e desça devagar.',
    cenario: ['tapete'],
    quadros: [
      { p: { ...EM_PE, ...DEITADO, cD: 145, kD: 15, pD: 95, cE: 143, kE: 13, pE: 93 }, d: 1.5, h: 0.5 },
      { p: { ...EM_PE, ...DEITADO, y: 148, lombar: -65, peito: -65, cabeca: -90, bD: 92, aD: 92, bE: 90, aE: 90, cD: 102, kD: -9, pD: 85, cE: 100, kE: -11, pE: 83 }, d: 1.5, h: 2 },
    ],
  },
  perdigueiro: {
    nome: 'Perdigueiro (braço e perna opostos)',
    instrucao: 'Em quatro apoios, estique um braço à frente e a perna oposta para trás, mantendo a coluna reta e o abdômen firme. Segure 3 segundos, volte e troque o lado.',
    cenario: ['tapete'],
    quadros: [
      { p: pose(QUATRO_APOIOS), d: 1.2, h: 0.4 },
      { p: pose({ ...QUATRO_APOIOS, bD: 95, aD: 95, mD: 95, cE: -95, kE: -95, pE: -5 }), d: 1.5, h: 2.5 },
      { p: pose(QUATRO_APOIOS), d: 1.2, h: 0.4 },
      { p: pose({ ...QUATRO_APOIOS, bE: 95, aE: 95, mE: 95, cD: -95, kD: -95, pD: -5 }), d: 1.5, h: 2.5 },
    ],
  },
  gato_vaca: {
    nome: 'Gato e vaca',
    instrucao: 'Em quatro apoios, solte o ar arredondando as costas para cima e olhando para o umbigo (gato). Depois inspire, afundando levemente as costas e olhando à frente (vaca).',
    cenario: ['tapete'],
    quadros: [
      { p: pose({ ...QUATRO_APOIOS, lombar: 128, peito: 98, cabeca: 30, bD: -8, aD: -6, bE: -6, aE: -4 }), d: 2.5, h: 1 },
      { p: pose({ ...QUATRO_APOIOS, lombar: 104, peito: 124, cabeca: 150, bD: 6, aD: 4, bE: 8, aE: 6 }), d: 2.5, h: 1 },
    ],
  },
  postura_crianca: {
    nome: 'Postura da criança',
    instrucao: 'Ajoelhado, sente sobre os calcanhares e leve o tronco à frente até a testa se aproximar do chão, com os braços esticados à frente. Respire fundo e relaxe a lombar.',
    cenario: ['tapete'],
    quadros: [
      { p: pose({ x: 70, y: 155, lombar: 75, peito: 78, cabeca: 50, bD: 85, aD: 88, mD: 90, bE: 86, aE: 89, mE: 90, cD: 45, kD: -90, pD: -90, cE: 44, kE: -90, pE: -90 }), d: 2.5, h: 1 },
      { p: pose({ x: 70, y: 152, lombar: 78, peito: 82, cabeca: 54, bD: 83, aD: 88, mD: 90, bE: 84, aE: 89, mE: 90, cD: 45, kD: -90, pD: -90, cE: 44, kE: -90, pE: -90 }), d: 2.5, h: 1 },
    ],
  },
  cachorro: {
    nome: 'Cachorro olhando para baixo',
    instrucao: 'De quatro apoios, empurre o chão e suba o quadril, formando um "V" invertido. Mantenha os braços esticados e tente levar os calcanhares em direção ao chão. Respire fundo.',
    cenario: ['tapete'],
    quadros: [
      { p: pose({ x: 95, y: 121, lombar: 53, peito: 53, cabeca: 30, bD: 53, aD: 53, mD: 90, bE: 51, aE: 51, mE: 90, cD: -36, kD: -36, pD: 75, cE: -35, kE: -35, pE: 75 }), d: 2.5, h: 1.5 },
      { p: pose({ x: 95, y: 117, lombar: 51, peito: 51, cabeca: 30, bD: 51, aD: 51, mD: 90, bE: 49, aE: 49, mE: 90, cD: -38, kD: -38, pD: 70, cE: -37, kE: -37, pE: 70 }), d: 2.5, h: 1.5 },
    ],
  },
  guerreiro: {
    nome: 'Guerreiro',
    instrucao: 'Dê um passo largo, dobre o joelho da frente sobre o tornozelo e mantenha a perna de trás esticada. Suba os braços acima da cabeça e respire fundo. Troque o lado.',
    cenario: ['tapete'],
    quadros: [
      { p: pose({ y: 133, cD: 68, kD: -4, cE: -45, kE: -45, pE: 50, bD: 178, aD: 178, bE: 176, aE: 176, cabeca: 172 }), d: 2, h: 2 },
      { p: pose({ y: 131, cD: 66, kD: -4, cE: -44, kE: -44, pE: 50, bD: 176, aD: 179, bE: 174, aE: 177, cabeca: 174 }), d: 2, h: 2 },
    ],
  },
  agachamento: {
    nome: 'Agachamento',
    instrucao: 'Pés na largura do quadril. Leve o quadril para trás e para baixo como quem vai sentar numa cadeira, com o peito aberto e os braços à frente. Suba empurrando o chão.',
    quadros: [
      { p: pose({ bD: 6, aD: 6 }), d: 1.4, h: 0.3 },
      { p: pose({ x: 86, y: 140, lombar: 145, peito: 148, cabeca: 165, cD: 70, kD: -35, cE: 68, kE: -36, bD: 95, aD: 95, bE: 93, aE: 93 }), d: 1.6, h: 0.6 },
    ],
  },
  afundo: {
    nome: 'Avanço (afundo)',
    instrucao: 'Dê um passo à frente e desça até os dois joelhos formarem ângulos de 90 graus, sem o joelho da frente passar da ponta do pé. Suba e alterne as pernas.',
    quadros: [
      { p: pose({ y: 120, cD: 35, kD: -2, cE: -24, kE: -30, pE: 55, bD: -10, aD: 70, bE: -10, aE: 70 }), d: 1.4, h: 0.3 },
      { p: pose({ y: 143, cD: 85, kD: 0, cE: -20, kE: -95, pE: -60, bD: -10, aD: 70, bE: -10, aE: 70 }), d: 1.6, h: 0.8 },
    ],
  },
  curl_up: {
    nome: 'Elevação do tronco (pilates)',
    instrucao: 'Deitado com os joelhos dobrados, solte o ar e tire cabeça e ombros do chão, levando as mãos em direção aos joelhos. Desça devagar inspirando.',
    cenario: ['tapete'],
    quadros: [
      { p: { ...EM_PE, ...DEITADO, cD: 145, kD: 15, pD: 95, cE: 143, kE: 13, pE: 93 }, d: 1.8, h: 0.5 },
      { p: { ...EM_PE, ...DEITADO, peito: -125, cabeca: -140, bD: 100, aD: 100, bE: 98, aE: 98, cD: 145, kD: 15, pD: 95, cE: 143, kE: 13, pE: 93 }, d: 1.8, h: 1.5 },
    ],
  },
  bicicleta: {
    nome: 'Pedalada',
    instrucao: 'Ajuste o banco para a perna ficar quase esticada com o pedal embaixo. Pedale em ritmo constante, com as costas relaxadas. Use capacete na rua.',
    cenario: ['bicicleta'],
    gerar: (t) => pedalada((t / 1.2) % 1),
  },
  natacao: {
    nome: 'Natação (nado livre)',
    instrucao: 'Alterne as braçadas, puxando a água para trás, e bata as pernas esticadas. Vire a cabeça de lado para respirar. Hidroginástica também vale!',
    cenario: ['agua'],
    quadros: [0, 1, 2, 3].map((i) => ({
      p: pose({
        x: 70, y: 112, lombar: 92, peito: 92, cabeca: 96,
        bD: [92, 0, -90, 180][i], aD: [92, 10, -90, 175][i], bE: [-90, 180, 92, 0][i], aE: [-90, 175, 92, 10][i],
        cD: [-84, -96, -84, -96][i], kD: [-82, -98, -82, -98][i], pD: -88, cE: [-96, -84, -96, -84][i], kE: [-98, -82, -98, -82][i], pE: -92,
      }),
      d: 0.45,
    })),
  },
  danca: {
    nome: 'Dança',
    instrucao: 'Coloque uma música animada e movimente braços e pernas no ritmo, mudando os passos. O importante é não parar!',
    quadros: [
      { p: pose({ y: 113, bD: 150, aD: 170, bE: 30, aE: 70, cD: 18, kD: 0, cE: -6, kE: -6 }), d: 0.45 },
      { p: pose({ y: 108, bD: 60, aD: 120, bE: 60, aE: 120 }), d: 0.45 },
      { p: pose({ y: 113, bE: 150, aE: 170, bD: 30, aD: 70, cE: 18, kE: 0, cD: -6, kD: -6 }), d: 0.45 },
      { p: pose({ y: 108, bD: 60, aD: 120, bE: 60, aE: 120 }), d: 0.45 },
    ],
  },
};

// ---------------- Guias por desafio ----------------

const AQUECIMENTO = [
  { mov: 'marcha', tempo: 120, fase: 'Aquecimento' },
  { mov: 'circulos_bracos', tempo: 40, fase: 'Aquecimento' },
];
const ALONGAMENTO_FINAL = [
  { mov: 'alongamento_quadriceps', tempo: 60, fase: 'Volta à calma', nota: '30 s cada perna' },
  { mov: 'alongamento_panturrilha', tempo: 60, fase: 'Volta à calma', nota: '30 s cada perna' },
  { mov: 'respiracao', tempo: 40, fase: 'Volta à calma' },
];
const CUIDADOS_FISICOS = [
  'Pare imediatamente se sentir dor no peito, tontura, falta de ar fora do normal ou dor nas articulações.',
  'Beba água antes, durante e depois.',
  'Se você tem alguma condição de saúde, confirme com seu médico quais atividades são seguras.',
];
const LEMBRETE_APP = 'Abra o app (Strava, Google Fit, Samsung Health ou Apple Saúde) e inicie a gravação antes de começar. Ao terminar, salve e tire um print da tela de resumo.';

export const GUIAS = {
  alongamento_membros_superiores_15: {
    resumo: 'Sequência para punhos, mãos, ombros e pescoço, que são as regiões mais exigidas por movimentos repetitivos. Faça a sequência duas vezes para completar cerca de 15 minutos. Pode ser feita no intervalo do trabalho.',
    repeticoes: 2,
    passos: [
      { mov: 'respiracao', tempo: 40, fase: 'Preparação' },
      { mov: 'circulos_bracos', tempo: 60 },
      { mov: 'extensao_punho', tempo: 60, nota: '30 s cada braço' },
      { mov: 'flexao_punho', tempo: 60, nota: '30 s cada braço' },
      { mov: 'flexao_pescoco', tempo: 60, nota: '20 s para frente e 20 s para cada lado' },
      { mov: 'gato_vaca', tempo: 60, nota: 'pode ser adaptado sentado, arredondando e abrindo o peito' },
      { mov: 'respiracao', tempo: 60, fase: 'Finalização' },
    ],
    dicas: ['Alongue até sentir uma tensão leve, nunca dor.', 'Não faça movimentos bruscos ou balanceados.', 'Repetir alguns destes alongamentos nas pausas do turno ajuda a prevenir LER/DORT.'],
  },
  circulacao_pernas_20: {
    resumo: 'Caminhada leve seguida de exercícios que ativam a circulação das pernas, ideal para quem passa o dia em pé.',
    passos: [
      { mov: 'caminhada', tempo: 600, fase: 'Caminhada leve' },
      { mov: 'panturrilha', tempo: 90, fase: 'Circulação', nota: '15 repetições lentas' },
      { mov: 'alongamento_panturrilha', tempo: 60, nota: '30 s cada perna' },
      { mov: 'alongamento_quadriceps', tempo: 60, nota: '30 s cada perna' },
      { mov: 'pernas_elevadas', tempo: 600, fase: 'Descanso' },
    ],
    dicas: ['Use calçados confortáveis.', 'Ao longo do turno, faça elevações de calcanhar sempre que puder.'],
  },
  fortalecimento_lombar_20: {
    resumo: 'Circuito de fortalecimento do abdômen e da lombar (core), que protege a coluna de quem carrega peso. Faça o circuito 3 vezes.',
    repeticoes: 3,
    passos: [
      { mov: 'marcha', tempo: 60, fase: 'Aquecimento' },
      { mov: 'gato_vaca', tempo: 45, fase: 'Circuito' },
      { mov: 'ponte', tempo: 45, nota: '12 repetições' },
      { mov: 'perdigueiro', tempo: 60, nota: '8 repetições de cada lado' },
      { mov: 'prancha', tempo: 30 },
      { mov: 'postura_crianca', tempo: 45, fase: 'Descanso' },
    ],
    dicas: ['Mantenha o abdômen contraído em todos os exercícios.', 'Ao levantar caixas, dobre os joelhos e mantenha a carga perto do corpo.'],
  },
  yoga_30: {
    resumo: 'Sequência de yoga para alongar coluna, ombros e quadris e reduzir o estresse. Faça o ciclo de posturas 2 vezes, com calma.',
    repeticoes: 2,
    passos: [
      { mov: 'respiracao', tempo: 120, fase: 'Centramento' },
      { mov: 'gato_vaca', tempo: 120, fase: 'Posturas' },
      { mov: 'cachorro', tempo: 90 },
      { mov: 'guerreiro', tempo: 120, nota: '1 min cada lado' },
      { mov: 'postura_crianca', tempo: 120 },
      { mov: 'pernas_elevadas', tempo: 180, fase: 'Relaxamento' },
    ],
    dicas: ['Respire sempre pelo nariz, devagar.', 'Use um tapete ou toalha.', 'Há aulas gratuitas de yoga em vídeo; o app de registro aceita a atividade "Yoga".'],
  },
  pilates_40: {
    resumo: 'Sessão de pilates de solo focada em abdômen, lombar e postura. Faça o circuito 3 vezes, priorizando o controle do movimento.',
    repeticoes: 3,
    passos: [
      { mov: 'respiracao', tempo: 90, fase: 'Respiração' },
      { mov: 'curl_up', tempo: 120, fase: 'Circuito', nota: '10 repetições' },
      { mov: 'ponte', tempo: 120, nota: '12 repetições' },
      { mov: 'perdigueiro', tempo: 120, nota: '8 de cada lado' },
      { mov: 'prancha', tempo: 60, nota: '2 × 30 s' },
      { mov: 'postura_crianca', tempo: 90, fase: 'Relaxamento' },
    ],
    dicas: ['No pilates, a qualidade do movimento vale mais que a quantidade.', 'Solte o ar no momento de maior esforço.'],
  },
  corrida_30: {
    resumo: 'Aqueça, corra pelo menos 30 minutos em ritmo constante e termine alongando. Se ainda não aguenta 30 minutos seguidos, alterne 3 min de corrida com 1 min de caminhada.',
    passos: [...AQUECIMENTO, { mov: 'corrida', tempo: 1800, fase: 'Corrida' }, { mov: 'caminhada', tempo: 180, fase: 'Volta à calma' }, ...ALONGAMENTO_FINAL],
    dicas: ['Use tênis de corrida.', 'Evite os horários mais quentes do dia.'],
  },
  caminhada_30: {
    resumo: 'Aqueça brevemente, caminhe 30 minutos em ritmo moderado e termine alongando as pernas.',
    passos: [{ mov: 'circulos_bracos', tempo: 40, fase: 'Aquecimento' }, { mov: 'caminhada', tempo: 1800, fase: 'Caminhada' }, ...ALONGAMENTO_FINAL],
    dicas: ['Escolha um percurso plano e seguro.', 'Chame alguém para caminhar junto: fica mais fácil manter o hábito.'],
  },
  funcional_30: {
    resumo: 'Treino funcional em circuito. Faça cada exercício pelo tempo indicado e repita o circuito 4 vezes.',
    repeticoes: 4,
    passos: [
      { mov: 'marcha', tempo: 60, fase: 'Circuito' },
      { mov: 'agachamento', tempo: 60, nota: '15 repetições' },
      { mov: 'afundo', tempo: 60, nota: '10 de cada perna' },
      { mov: 'prancha', tempo: 30 },
      { mov: 'ponte', tempo: 45, nota: '15 repetições' },
      { mov: 'perdigueiro', tempo: 45, nota: '8 de cada lado' },
      { mov: 'respiracao', tempo: 60, fase: 'Descanso entre circuitos' },
    ],
    dicas: ['Escolha um espaço livre e seguro.', 'Comece devagar e aumente a intensidade nas próximas semanas.'],
  },
  bicicleta_45: {
    resumo: 'Aqueça, pedale pelo menos 45 minutos em ritmo constante e termine alongando.',
    passos: [...AQUECIMENTO, { mov: 'bicicleta', tempo: 2700, fase: 'Pedalada' }, ...ALONGAMENTO_FINAL],
    dicas: ['Use capacete e respeite as regras de trânsito.', 'Bicicleta ergométrica também vale; registre no app como "Pedalada" ou "Virtual Ride".'],
  },
  natacao_40: {
    resumo: 'Aqueça fora da água, nade ou faça hidroginástica por pelo menos 40 minutos e alongue no final.',
    passos: [{ mov: 'circulos_bracos', tempo: 60, fase: 'Aquecimento' }, { mov: 'natacao', tempo: 2400, fase: 'Na água' }, ...ALONGAMENTO_FINAL],
    dicas: ['Relógios à prova d\'água registram a natação automaticamente.', 'Se não tiver relógio, peça o comprovante de frequência da piscina/academia com seu nome, data e duração.'],
  },
  danca_30: {
    resumo: 'Aqueça, dance por 30 minutos e termine alongando.',
    passos: [...AQUECIMENTO, { mov: 'danca', tempo: 1800, fase: 'Dança' }, ...ALONGAMENTO_FINAL],
    dicas: ['Vale aula de dança, zumba ou dançar em casa com um vídeo.', 'Registre no app como "Dança" ou "Treino".'],
  },
};

export const GUIAS_PREVENTIVOS = {
  _padrao: [
    'Agende o exame ou a consulta numa Unidade Básica de Saúde (UBS) ou pelo seu plano de saúde.',
    'Leve documento com foto, cartão do SUS ou do plano e, se houver, o pedido médico.',
    'No dia, siga as orientações de preparo (jejum, roupas confortáveis etc.) que o local informar.',
    'Guarde o laudo, o resultado ou o comprovante de atendimento, com seu nome e a data.',
    'Fotografe ou salve o PDF e envie aqui como comprovante.',
  ],
  mamografia: ['Não use desodorante, talco ou creme nas mamas e axilas no dia do exame.', 'Se possível, agende fora do período menstrual, quando as mamas ficam menos sensíveis.'],
  papanicolau: ['Evite relações sexuais, duchas e cremes vaginais nos 2 dias anteriores.', 'Não faça o exame durante a menstruação.'],
  glicemia: ['Faça jejum de 8 horas (água é permitida).'],
  colesterol: ['Siga a orientação do laboratório sobre jejum (muitos já dispensam).'],
  rastreamento_colorretal: ['Retire o kit de coleta no laboratório e siga as instruções da embalagem.'],
  pressao_arterial: ['Descanse 5 minutos sentado antes da medição e evite café e cigarro 30 minutos antes.', 'Muitas farmácias e UBS medem a pressão gratuitamente; peça o registro por escrito.'],
  vacinacao: ['Leve seu cartão de vacinação. Se não tiver, a UBS pode consultar seu histórico pelo CPF.'],
};

export const guiaDe = (codigo) => GUIAS[codigo] ?? null;
export const cuidadosFisicos = CUIDADOS_FISICOS;
export const lembreteApp = LEMBRETE_APP;
export const preparoPreventivo = (codigo) => ({ passos: GUIAS_PREVENTIVOS._padrao, extras: GUIAS_PREVENTIVOS[codigo] ?? [] });

// ---------------- Desenho ----------------

const suave = (t) => t * t * (3 - 2 * t);
const interp = (a, b, t) => {
  let delta = ((b - a + 540) % 360) - 180; // menor caminho entre ângulos
  return a + delta * t;
};

function completar(p) {
  const r = { ...p };
  r.peito ??= r.lombar;
  r.cabeca ??= r.peito;
  r.mE ??= r.aE; r.mD ??= r.aD;
  r.pE ??= r.kE + 90; r.pD ??= r.kD + 90;
  return r;
}

function misturar(a, b, t) {
  const A = completar(a), B = completar(b), r = {};
  for (const k of Object.keys(A)) r[k] = k === 'x' || k === 'y' ? A[k] + (B[k] - A[k]) * t : interp(A[k], B[k], t);
  return r;
}

/** Pose do movimento no instante t (segundos). */
export function poseNoTempo(mov, t) {
  if (mov.gerar) return completar(mov.gerar(t));
  const q = mov.quadros;
  const ciclo = q.reduce((s, f) => s + f.d + (f.h ?? 0), 0);
  let resto = t % ciclo;
  for (let i = 0; i < q.length; i++) {
    const anterior = q[(i - 1 + q.length) % q.length].p;
    const { p, d, h = 0 } = q[i];
    if (resto < d) return misturar(anterior, p, suave(resto / d));
    resto -= d;
    if (resto < h) return completar(p);
    resto -= h;
  }
  return completar(q[0].p);
}

const seg = (x1, y1, x2, y2, cls) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}"/>`;

function boneco(p) {
  const H = [p.x, p.y];
  const soma = ([x, y], g, l) => { const [dx, dy] = dir(g, l); return [x + dx, y + dy]; };
  const meio = soma(H, p.lombar, L.lombar);
  const S = soma(meio, p.peito, L.peito);
  const N = soma(S, p.cabeca, L.pescoco);
  const C = soma(N, p.cabeca, L.cabeca);
  const olho = soma(soma(C, p.cabeca - 90, 4.5), p.cabeca, 1.5);
  const membro = (origem, angulos, comps, cls) => {
    let atual = origem, out = '';
    angulos.forEach((g, i) => { const prox = soma(atual, g, comps[i]); out += seg(...atual, ...prox, cls[i] ?? cls.at(-1)); atual = prox; });
    return out;
  };
  const braco = (s) => membro(S, [p[`b${s}`], p[`a${s}`], p[`m${s}`]], [L.braco, L.antebraco, L.mao], [`m ${s}`, `m ${s}`, `mao ${s}`]);
  const perna_ = (s) => membro(H, [p[`c${s}`], p[`k${s}`], p[`p${s}`]], [L.coxa, L.canela, L.pe], [`m ${s}`, `m ${s}`, `pe ${s}`]);
  return `${braco('E')}${perna_('E')}
    ${seg(...H, ...meio, 'tronco')}${seg(...meio, ...S, 'tronco')}${seg(...S, ...N, 'm D')}
    <circle cx="${C[0].toFixed(1)}" cy="${C[1].toFixed(1)}" r="${L.cabeca}" class="cabeca"/>
    <circle cx="${olho[0].toFixed(1)}" cy="${olho[1].toFixed(1)}" r="1.4" class="olho"/>
    ${perna_('D')}${braco('D')}`;
}

function cenario(itens = []) {
  let s = `<line x1="0" y1="${CHAO}" x2="200" y2="${CHAO}" class="chao"/>`;
  if (itens.includes('tapete')) s += `<rect x="10" y="${CHAO - 2}" width="180" height="4" rx="2" class="tapete"/>`;
  if (itens.includes('parede')) s += `<rect x="172" y="20" width="10" height="${CHAO - 20}" class="parede"/>`;
  if (itens.includes('parede_baixa')) s += `<rect x="125" y="40" width="10" height="${CHAO - 40}" class="parede"/>`;
  if (itens.includes('agua')) s = `<rect x="0" y="96" width="200" height="104" class="agua"/><path d="M0 96 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" class="onda"/>`;
  if (itens.includes('bicicleta')) {
    s += `<g class="bike"><circle cx="52" cy="158" r="21"/><circle cx="152" cy="158" r="21"/>
      <path d="M52 158 L96 110 L104 158 Z M96 110 L140 108 L152 158 M104 158 L140 108 M140 108 L138 92 L150 90 M88 106 L104 106"/>
      <circle cx="104" cy="158" r="13" class="pedivela"/></g>`;
  }
  return s;
}

/** Instante que melhor representa o movimento (fim da primeira transição), usado nas miniaturas. */
export function instanteTipico(mov) {
  if (mov.gerar) return 0.3;
  const [a, b] = mov.quadros;
  return b ? a.d + (a.h ?? 0) + b.d : 0;
}

/** Desenha o movimento no SVG no instante t. */
export function desenhar(svg, mov, t) {
  svg.innerHTML = `${cenario(mov.cenario)}${boneco(poseNoTempo(mov, t))}`;
}
