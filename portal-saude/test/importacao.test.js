import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { run } from '../src/db.js';
import { converterData, converterSexo, lerCsv, lerPlanilha, validarLinhas } from '../src/services/importacao.js';

const setor = Number(run(`INSERT INTO setores (nome) VALUES ('Frente de Caixa')`).lastInsertRowid);
run(`INSERT INTO cargos (setor_id, nome) VALUES (?, 'Operador de Caixa')`, setor);
run(`INSERT INTO usuarios (matricula, nome, senha_hash) VALUES ('900', 'Já Existe', 'x:y')`);

test('converte datas e sexo em formatos comuns', () => {
  assert.equal(converterData('05/03/1990'), '1990-03-05');
  assert.equal(converterData('1990-03-05'), '1990-03-05');
  assert.equal(converterData(32937), '1990-03-05'); // serial do Excel
  assert.equal(converterData('31/02/1990'), null);
  assert.equal(converterData('ontem'), null);
  assert.equal(converterSexo('Feminino'), 'F');
  assert.equal(converterSexo('m'), 'M');
  assert.equal(converterSexo('x'), null);
});

test('aponta linhas com erro, dados faltando, duplicadas e já cadastradas', () => {
  const csv = [
    'Nome;Matrícula;Data de nascimento;Sexo;Setor;Cargo',
    'Maria Souza;100;15/03/1985;F;Frente de Caixa;Operador de Caixa',
    'João;101;;M;Frente de Caixa;Operador de Caixa',
    'Ana Lima;100;01/01/1990;F;Frente de Caixa;Operador de Caixa',
    'Pedro Alves;102;01/01/1990;Z;Padaria;Padeiro',
    ';;;;;',
    'Carlos Dias;103;10/10/1980;M;frente de caixa;Gerente',
    'Já Existe Silva;900;10/10/1980;M;Frente de Caixa;Operador de Caixa',
  ].join('\n');
  const { linhas } = validarLinhas(lerCsv(csv));
  assert.equal(linhas.length, 6); // linha em branco ignorada
  const [maria, joao, ana, pedro, carlos, existente] = linhas;
  assert.ok(maria.valido);
  assert.deepEqual([maria.dados.data_nascimento, maria.dados.sexo], ['1985-03-15', 'F']);
  assert.ok(!joao.valido && joao.erros.some((e) => /nascimento não informada/.test(e)));
  assert.ok(joao.avisos.some((a) => /sobrenome/.test(a)));
  assert.ok(!ana.valido && ana.erros.some((e) => /repetida.*linha 2/.test(e)));
  assert.ok(!pedro.valido && pedro.erros.some((e) => /Sexo inválido/.test(e)) && pedro.erros.some((e) => /Setor "Padaria"/.test(e)));
  assert.ok(!carlos.valido && carlos.erros.some((e) => /Cargo "Gerente"/.test(e)));
  assert.ok(existente.valido && existente.avisos.some((a) => /já cadastrada/.test(a)));
  assert.equal(pedro.linha, 5);
});

test('recusa planilha sem as colunas obrigatórias', () => {
  const r = validarLinhas(lerCsv('nome,matricula\nMaria,1'));
  assert.match(r.erroGeral, /data_nascimento, sexo, setor, cargo/);
});

test('lê arquivos .xlsx', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Colaboradores');
  ws.addRow(['nome', 'matricula', 'data_nascimento', 'sexo', 'setor', 'cargo']);
  ws.addRow(['Maria Souza', 200, new Date(Date.UTC(1985, 2, 15)), 'F', 'Frente de Caixa', 'Operador de Caixa']);
  const linhas = await lerPlanilha(Buffer.from(await wb.xlsx.writeBuffer()), 'colab.xlsx');
  const { linhas: r } = validarLinhas(linhas);
  assert.ok(r[0].valido, r[0].erros.join());
  assert.equal(r[0].dados.matricula, '200');
  assert.equal(r[0].dados.data_nascimento, '1985-03-15');
});
