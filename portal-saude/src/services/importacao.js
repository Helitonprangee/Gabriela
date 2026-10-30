import ExcelJS from 'exceljs';
import { all } from '../db.js';

export const COLUNAS = ['nome', 'matricula', 'data_nascimento', 'sexo', 'setor', 'cargo'];

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Aceita variações comuns de cabeçalho.
const APELIDOS = {
  nome: ['nome', 'nome completo', 'colaborador'],
  matricula: ['matricula', 'matrícula', 'registro', 'mat'],
  data_nascimento: ['data_nascimento', 'data de nascimento', 'nascimento', 'dt nascimento', 'data nasc'],
  sexo: ['sexo', 'genero', 'gênero'],
  setor: ['setor', 'departamento', 'area'],
  cargo: ['cargo', 'funcao', 'função'],
};

function mapearCabecalho(cabecalho) {
  const mapa = {};
  cabecalho.forEach((titulo, i) => {
    const t = normalizar(titulo);
    for (const [col, nomes] of Object.entries(APELIDOS)) {
      if (nomes.some((n) => normalizar(n) === t)) mapa[col] = i;
    }
  });
  return mapa;
}

/** Lê .xlsx ou .csv e devolve as linhas como arrays de valores. */
export async function lerPlanilha(buffer, nomeArquivo) {
  if (/\.csv$/i.test(nomeArquivo)) return lerCsv(buffer.toString('utf8').replace(/^﻿/, ''));
  if (!/\.xlsx$/i.test(nomeArquivo)) throw new Error('Envie um arquivo .xlsx ou .csv.');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('A planilha está vazia.');
  const linhas = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const valores = [];
    for (let c = 1; c <= Math.max(ws.columnCount, COLUNAS.length); c++) {
      let v = row.getCell(c).value;
      if (v && typeof v === 'object' && !(v instanceof Date)) v = v.text ?? v.result ?? v.richText?.map((t) => t.text).join('') ?? '';
      valores.push(v);
    }
    linhas.push(valores);
  });
  return linhas;
}

export function lerCsv(texto) {
  const sep = (texto.split('\n')[0].match(/;/g)?.length ?? 0) > (texto.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += ch;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

/** Converte dd/mm/aaaa, aaaa-mm-dd, Date ou número serial do Excel para AAAA-MM-DD. */
export function converterData(valor) {
  if (valor == null || valor === '') return null;
  let d;
  if (valor instanceof Date) d = new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()));
  else if (typeof valor === 'number') d = new Date(Date.UTC(1899, 11, 30) + valor * 86_400_000);
  else {
    const s = String(valor).trim();
    let m;
    if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    else return null;
    // rejeita datas como 31/02, que o Date "corrige" para março
    const [dia, mes] = m[3]?.length === 4 ? [+m[1], +m[2]] : [+m[3], +m[2]];
    if (d.getUTCDate() !== dia || d.getUTCMonth() + 1 !== mes) return null;
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function converterSexo(valor) {
  const s = normalizar(valor);
  if (['f', 'fem', 'feminino', 'mulher'].includes(s)) return 'F';
  if (['m', 'masc', 'masculino', 'homem'].includes(s)) return 'M';
  if (['o', 'outro', 'outros', 'nao binario', 'nao-binario'].includes(s)) return 'O';
  return null;
}

/**
 * Confere cada linha da planilha e devolve o que pode ser importado e os problemas encontrados.
 * Nada é gravado aqui; a gravação acontece só depois que o RH confirma a prévia.
 */
export function validarLinhas(linhas, hoje = new Date()) {
  const idxCabecalho = linhas.findIndex((l) => l.some((v) => String(v ?? '').trim() !== ''));
  if (idxCabecalho < 0) return { erroGeral: 'A planilha está vazia.', linhas: [] };
  const mapa = mapearCabecalho(linhas[idxCabecalho]);
  const faltando = COLUNAS.filter((c) => mapa[c] == null);
  if (faltando.length) {
    return { erroGeral: `Colunas obrigatórias não encontradas no cabeçalho: ${faltando.join(', ')}.`, linhas: [] };
  }

  const setores = new Map(all('SELECT id, nome FROM setores').map((s) => [normalizar(s.nome), s]));
  const cargos = all('SELECT id, nome, setor_id FROM cargos');
  const existentes = new Set(all('SELECT matricula FROM usuarios').map((u) => u.matricula));
  const vistas = new Map();
  const resultado = [];

  linhas.slice(idxCabecalho + 1).forEach((valores, i) => {
    const numero = idxCabecalho + i + 2; // número da linha como aparece no Excel
    const bruto = Object.fromEntries(COLUNAS.map((c) => [c, valores[mapa[c]]]));
    if (COLUNAS.every((c) => String(bruto[c] ?? '').trim() === '')) return; // linha em branco

    const erros = [];
    const avisos = [];
    const nome = String(bruto.nome ?? '').trim().replace(/\s+/g, ' ');
    const matricula = String(bruto.matricula ?? '').trim();
    const data = converterData(bruto.data_nascimento);
    const sexo = converterSexo(bruto.sexo);
    const setor = setores.get(normalizar(bruto.setor));
    const cargo = setor && cargos.find((c) => c.setor_id === setor.id && normalizar(c.nome) === normalizar(bruto.cargo));

    if (!nome) erros.push('Nome não informado.');
    else if (nome.split(' ').length < 2) avisos.push('Informe nome e sobrenome (usado para conferir os comprovantes).');
    if (!matricula) erros.push('Matrícula não informada.');
    else if (!/^[A-Za-z0-9._-]{1,30}$/.test(matricula)) erros.push('Matrícula com caracteres inválidos.');
    else if (vistas.has(matricula)) erros.push(`Matrícula repetida na planilha (também na linha ${vistas.get(matricula)}).`);
    else if (existentes.has(matricula)) avisos.push('Matrícula já cadastrada: os dados serão atualizados (a senha não muda).');
    if (matricula) vistas.set(matricula, vistas.get(matricula) ?? numero);

    if (String(bruto.data_nascimento ?? '').trim() === '') erros.push('Data de nascimento não informada.');
    else if (!data) erros.push(`Data de nascimento inválida: "${bruto.data_nascimento}". Use dd/mm/aaaa.`);
    else {
      const idade = (hoje - new Date(data)) / (365.25 * 86_400_000);
      if (idade < 14 || idade > 90) erros.push(`Data de nascimento fora do esperado (${data}).`);
    }
    if (String(bruto.sexo ?? '').trim() === '') erros.push('Sexo não informado.');
    else if (!sexo) erros.push(`Sexo inválido: "${bruto.sexo}". Use F, M ou O.`);
    if (String(bruto.setor ?? '').trim() === '') erros.push('Setor não informado.');
    else if (!setor) erros.push(`Setor "${bruto.setor}" não está cadastrado.`);
    if (String(bruto.cargo ?? '').trim() === '') erros.push('Cargo não informado.');
    else if (setor && !cargo) erros.push(`Cargo "${bruto.cargo}" não está cadastrado no setor ${setor.nome}.`);

    resultado.push({
      linha: numero,
      valido: erros.length === 0,
      erros,
      avisos,
      dados: { nome, matricula, data_nascimento: data, sexo, setor_id: setor?.id, cargo_id: cargo?.id, setor: setor?.nome ?? bruto.setor, cargo: cargo?.nome ?? bruto.cargo },
    });
  });

  return { linhas: resultado };
}
