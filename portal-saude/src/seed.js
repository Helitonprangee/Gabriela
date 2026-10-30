// Dados de demonstração: setores, cargos com funções e riscos, e alguns colaboradores.
// Uso: npm run seed
import { one, run, transaction } from './db.js';
import { hashSenha } from './auth.js';
import { config } from './config.js';

const SETORES = [
  {
    nome: 'Frente de Caixa', descricao: 'Checkouts e atendimento no fechamento das compras.',
    cargos: [
      {
        nome: 'Operador(a) de Caixa', descricao: 'Registra as compras no caixa, recebe pagamentos e atende clientes durante todo o turno.',
        funcoes: [
          ['Registrar produtos', 'Passa os produtos no scanner e digita códigos de barras ilegíveis, centenas de vezes por turno.'],
          ['Receber pagamentos', 'Opera a máquina de cartão, recebe dinheiro e dá troco.'],
          ['Ensacar compras', 'Ajuda o cliente a ensacar as compras.'],
        ],
        riscos: { movimentos_repetitivos: 3, horas_em_pe: 4, horas_sentado: 4, carrega_peso: 1, atendimento_publico: 3, regioes_sobrecarga: 'punhos,ombros,pescoco' },
      },
      {
        nome: 'Fiscal de Caixa', descricao: 'Supervisiona os caixas, autoriza estornos e resolve problemas com clientes, circulando pela loja.',
        funcoes: [['Autorizar operações', 'Libera cancelamentos, estornos e sangrias.'], ['Atender reclamações', 'Resolve conflitos com clientes.']],
        riscos: { movimentos_repetitivos: 1, horas_em_pe: 7, atendimento_publico: 3, regioes_sobrecarga: 'pernas' },
      },
    ],
  },
  {
    nome: 'Reposição e Estoque', descricao: 'Recebimento de mercadorias e abastecimento das gôndolas.',
    cargos: [
      {
        nome: 'Repositor(a)', descricao: 'Abastece as gôndolas, confere validades e organiza os produtos nos corredores.',
        funcoes: [['Abastecer gôndolas', 'Carrega caixas e fardos do estoque até os corredores.'], ['Conferir validade', 'Retira produtos vencidos.']],
        riscos: { movimentos_repetitivos: 2, horas_em_pe: 8, carrega_peso: 3, regioes_sobrecarga: 'coluna,ombros,pernas' },
      },
      {
        nome: 'Conferente de Câmara Fria', descricao: 'Recebe e organiza mercadorias refrigeradas e congelados na câmara fria.',
        funcoes: [['Receber mercadorias', 'Confere notas e descarrega paletes.'], ['Organizar câmara fria', 'Movimenta caixas de congelados.']],
        riscos: { horas_em_pe: 7, carrega_peso: 3, ambiente_frio: 1, regioes_sobrecarga: 'coluna' },
      },
    ],
  },
  {
    nome: 'Padaria', descricao: 'Produção e venda de pães, bolos e salgados.',
    cargos: [{
      nome: 'Padeiro(a)', descricao: 'Prepara massas e assa pães no forno, a partir da madrugada.',
      funcoes: [['Preparar massas', 'Sova e modela massas.'], ['Operar forno', 'Controla o forno em temperatura alta.']],
      riscos: { movimentos_repetitivos: 2, horas_em_pe: 7, carrega_peso: 2, ambiente_calor: 1, turno_noturno: 1, regioes_sobrecarga: 'punhos,coluna' },
    }],
  },
  {
    nome: 'Administrativo', descricao: 'Escritório da loja.',
    cargos: [{
      nome: 'Assistente Administrativo', descricao: 'Lança notas no sistema, controla planilhas e apoia a gerência no escritório.',
      funcoes: [['Lançar notas fiscais', 'Digita dados no computador a maior parte do dia.']],
      riscos: { movimentos_repetitivos: 1, horas_sentado: 7, regioes_sobrecarga: 'pescoco,coluna' },
    }],
  },
];

const LOJAS = [['Loja Centro', 'Curitiba'], ['Loja Bairro Alto', 'Curitiba'], ['Loja São José', 'São José dos Pinhais']];

const COLABORADORES = [
  ['10001', 'Maria Aparecida Souza', '1975-04-12', 'F', 'Frente de Caixa', 'Operador(a) de Caixa', 'Loja Centro'],
  ['10002', 'Lucas Ferreira Lima', '2005-09-30', 'M', 'Frente de Caixa', 'Operador(a) de Caixa', 'Loja Centro'],
  ['10003', 'Juliana Costa Ribeiro', '1992-01-18', 'F', 'Frente de Caixa', 'Fiscal de Caixa', 'Loja Bairro Alto'],
  ['10004', 'José Carlos Pereira', '1968-07-03', 'M', 'Reposição e Estoque', 'Repositor(a)', 'Loja Bairro Alto'],
  ['10005', 'Ana Beatriz Martins', '1999-11-22', 'F', 'Reposição e Estoque', 'Conferente de Câmara Fria', 'Loja São José'],
  ['10006', 'Roberto Alves Nunes', '1981-02-14', 'M', 'Padaria', 'Padeiro(a)', 'Loja São José'],
  ['10007', 'Fernanda Oliveira Rocha', '1988-06-05', 'F', 'Administrativo', 'Assistente Administrativo', 'Loja Centro'],
];

const PARCEIROS = [['Pizzaria Forno a Lenha', 'contato@pizzaria.exemplo'], ['Restaurante Sabor Caseiro', '(41) 3333-0000']];
const RECOMPENSAS = [
  [null, 'Dia de folga', 'Um dia de folga, com data combinada com o gestor.', 'folga', 300, null],
  ['Restaurante Sabor Caseiro', 'Vale-refeição R$ 30', 'Válido por 60 dias no restaurante parceiro.', 'vale_refeicao', 60, 20],
  ['Pizzaria Forno a Lenha', 'Vale-pizza grande', 'Uma pizza grande para retirar ou receber em casa.', 'voucher', 80, 10],
  [null, 'Garrafa térmica Viva Bem', 'Para manter a hidratação durante o turno.', 'produto', 40, 30],
];

transaction(() => {
  const cargoIds = {};
  for (const s of SETORES) {
    const setorId = one('SELECT id FROM setores WHERE nome = ?', s.nome)?.id
      ?? Number(run('INSERT INTO setores (nome, descricao) VALUES (?, ?)', s.nome, s.descricao).lastInsertRowid);
    for (const c of s.cargos) {
      let cargoId = one('SELECT id FROM cargos WHERE setor_id = ? AND nome = ?', setorId, c.nome)?.id;
      if (!cargoId) {
        cargoId = Number(run('INSERT INTO cargos (setor_id, nome, descricao) VALUES (?, ?, ?)', setorId, c.nome, c.descricao).lastInsertRowid);
        for (const [nome, descricao] of c.funcoes) run('INSERT INTO funcoes (cargo_id, nome, descricao) VALUES (?, ?, ?)', cargoId, nome, descricao);
        const campos = Object.keys(c.riscos);
        run(`INSERT INTO cargo_riscos (cargo_id, ${campos.join(', ')}) VALUES (?, ${campos.map(() => '?').join(', ')})`,
          cargoId, ...Object.values(c.riscos));
      }
      cargoIds[`${s.nome}|${c.nome}`] = { setorId, cargoId };
    }
  }
  for (const [nome, cidade] of LOJAS) run('INSERT OR IGNORE INTO lojas (nome, cidade) VALUES (?, ?)', nome, cidade);
  const senha = hashSenha(config.senhaInicial);
  for (const [matricula, nome, nascimento, sexo, setor, cargo, loja] of COLABORADORES) {
    if (one('SELECT 1 FROM usuarios WHERE matricula = ?', matricula)) continue;
    const { setorId, cargoId } = cargoIds[`${setor}|${cargo}`];
    run(`INSERT INTO usuarios (matricula, nome, data_nascimento, sexo, setor_id, cargo_id, loja_id, senha_hash)
         VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM lojas WHERE nome = ?), ?)`,
      matricula, nome, nascimento, sexo, setorId, cargoId, loja, senha);
  }
  if (!one('SELECT 1 FROM parceiros')) {
    for (const [nome, contato] of PARCEIROS) run('INSERT INTO parceiros (nome, contato) VALUES (?, ?)', nome, contato);
    for (const [parceiro, titulo, descricao, tipo, custo, estoque] of RECOMPENSAS) {
      run(`INSERT INTO recompensas (parceiro_id, titulo, descricao, tipo, custo_pontos, estoque)
           VALUES ((SELECT id FROM parceiros WHERE nome = ?), ?, ?, ?, ?, ?)`, parceiro, titulo, descricao, tipo, custo, estoque);
    }
  }
});

console.log(`Dados de demonstração carregados. Colaboradores: matrículas 10001 a 10007, senha inicial ${config.senhaInicial}.`);
