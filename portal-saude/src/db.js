import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS setores (
  id          INTEGER PRIMARY KEY,
  nome        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  descricao   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cargos (
  id          INTEGER PRIMARY KEY,
  setor_id    INTEGER NOT NULL REFERENCES setores(id) ON DELETE RESTRICT,
  nome        TEXT NOT NULL COLLATE NOCASE,
  descricao   TEXT,
  -- incrementa a cada mudança de descrição/funções/riscos; os desafios guardam a versão usada
  versao      INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (setor_id, nome)
);

CREATE TABLE IF NOT EXISTS funcoes (
  id          INTEGER PRIMARY KEY,
  cargo_id    INTEGER NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  descricao   TEXT
);

-- Riscos ergonômicos e ambientais da rotina de cada cargo.
-- Níveis: 0 = nenhum, 1 = baixo, 2 = médio, 3 = alto.
CREATE TABLE IF NOT EXISTS cargo_riscos (
  cargo_id                INTEGER PRIMARY KEY REFERENCES cargos(id) ON DELETE CASCADE,
  movimentos_repetitivos  INTEGER NOT NULL DEFAULT 0,
  horas_em_pe             REAL    NOT NULL DEFAULT 0,
  horas_sentado           REAL    NOT NULL DEFAULT 0,
  carrega_peso            INTEGER NOT NULL DEFAULT 0,
  ambiente_frio           INTEGER NOT NULL DEFAULT 0,
  ambiente_calor          INTEGER NOT NULL DEFAULT 0,
  turno_noturno           INTEGER NOT NULL DEFAULT 0,
  atendimento_publico     INTEGER NOT NULL DEFAULT 0,
  -- regiões do corpo mais sobrecarregadas, separadas por vírgula
  -- (punhos, ombros, pescoco, coluna, pernas)
  regioes_sobrecarga      TEXT    NOT NULL DEFAULT '',
  observacoes             TEXT
);

CREATE TABLE IF NOT EXISTS usuarios (
  id                     INTEGER PRIMARY KEY,
  matricula              TEXT NOT NULL UNIQUE,
  nome                   TEXT NOT NULL,
  data_nascimento        TEXT,
  sexo                   TEXT CHECK (sexo IN ('F','M','O')),
  setor_id               INTEGER REFERENCES setores(id),
  cargo_id               INTEGER REFERENCES cargos(id),
  papel                  TEXT NOT NULL DEFAULT 'colaborador' CHECK (papel IN ('colaborador','rh')),
  senha_hash             TEXT NOT NULL,
  deve_trocar_senha      INTEGER NOT NULL DEFAULT 1,
  ativo                  INTEGER NOT NULL DEFAULT 1,
  -- perfil complementado pelo próprio colaborador
  email                  TEXT,
  telefone               TEXT,
  altura_cm              REAL,
  peso_kg                REAL,
  nivel_atividade        TEXT CHECK (nivel_atividade IN ('sedentario','leve','moderado','intenso')),
  atividades_preferidas  TEXT NOT NULL DEFAULT '',
  restricoes             TEXT NOT NULL DEFAULT '',
  observacoes_saude      TEXT,
  ultimo_acesso          TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessoes (
  token       TEXT PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS desafios (
  id                 INTEGER PRIMARY KEY,
  usuario_id         INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modelo_codigo      TEXT NOT NULL,
  categoria          TEXT NOT NULL CHECK (categoria IN ('atividade_fisica','saude_preventiva')),
  titulo             TEXT NOT NULL,
  descricao          TEXT NOT NULL,
  motivo             TEXT NOT NULL,
  como_comprovar     TEXT NOT NULL,
  app_sugerido       TEXT,
  criterios          TEXT NOT NULL,          -- JSON usado pela validação
  pontos             INTEGER NOT NULL,
  prazo              TEXT NOT NULL,          -- AAAA-MM-DD
  status             TEXT NOT NULL DEFAULT 'ativo'
                     CHECK (status IN ('ativo','em_analise','concluido','expirado')),
  cargo_id           INTEGER,
  cargo_versao       INTEGER,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  concluido_em       TEXT
);
CREATE INDEX IF NOT EXISTS idx_desafios_usuario ON desafios(usuario_id, status);

CREATE TABLE IF NOT EXISTS comprovantes (
  id             INTEGER PRIMARY KEY,
  desafio_id     INTEGER NOT NULL REFERENCES desafios(id) ON DELETE CASCADE,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  arquivo        TEXT NOT NULL,
  nome_original  TEXT NOT NULL,
  mime           TEXT NOT NULL,
  sha256         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'em_analise'
                 CHECK (status IN ('em_analise','aprovado','recusado')),
  motivo         TEXT,
  analise        TEXT,                       -- JSON com o parecer completo
  suspeita_ia    INTEGER NOT NULL DEFAULT 0,
  validado_por   TEXT,                       -- 'ia' ou 'rh:<id>'
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  validado_em    TEXT
);
CREATE INDEX IF NOT EXISTS idx_comprovantes_status ON comprovantes(status);
CREATE INDEX IF NOT EXISTS idx_comprovantes_sha ON comprovantes(sha256);

-- Livro-razão de pontos: o saldo é sempre a soma dos lançamentos.
-- Créditos vêm de desafios; débitos virão dos resgates (Fase 2).
CREATE TABLE IF NOT EXISTS pontos_lancamentos (
  id            INTEGER PRIMARY KEY,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pontos        INTEGER NOT NULL,            -- positivo = crédito, negativo = débito
  origem        TEXT NOT NULL CHECK (origem IN ('desafio','resgate','estorno','ajuste')),
  referencia_id INTEGER,
  descricao     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (origem, referencia_id)
);
CREATE INDEX IF NOT EXISTS idx_pontos_usuario ON pontos_lancamentos(usuario_id);

-- ===== FASE 2: recompensas (estrutura pronta, ainda sem telas) =====
CREATE TABLE IF NOT EXISTS parceiros (
  id          INTEGER PRIMARY KEY,
  nome        TEXT NOT NULL,
  contato     TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recompensas (
  id            INTEGER PRIMARY KEY,
  parceiro_id   INTEGER REFERENCES parceiros(id),   -- NULL = benefício interno (ex.: folga)
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  tipo          TEXT NOT NULL CHECK (tipo IN ('folga','vale_refeicao','voucher','produto','outro')),
  custo_pontos  INTEGER NOT NULL CHECK (custo_pontos > 0),
  estoque       INTEGER,                            -- NULL = ilimitado
  ativo         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resgates (
  id              INTEGER PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
  recompensa_id   INTEGER NOT NULL REFERENCES recompensas(id),
  pontos          INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'solicitado'
                  CHECK (status IN ('solicitado','aprovado','entregue','cancelado')),
  codigo_voucher  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT
);
`;

db.exec(SCHEMA);

/** Executa fn dentro de uma transação. */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const one = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
