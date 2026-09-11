import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let schemaReady: Promise<void> | null = null;

function databasePool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URLが設定されていません');
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }

  return pool;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = databasePool()
      .query(`
        CREATE TABLE IF NOT EXISTS rooms (
          code TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS presence (
          code TEXT NOT NULL,
          player TEXT NOT NULL,
          seen BIGINT NOT NULL,
          PRIMARY KEY (code, player)
        );

        CREATE TABLE IF NOT EXISTS card_hover (
          code TEXT PRIMARY KEY,
          player TEXT NOT NULL,
          serial INTEGER NOT NULL,
          target TEXT,
          slot INTEGER,
          seen BIGINT NOT NULL
        );
      `)
      .then(() => undefined);
  }

  return schemaReady;
}

function postgresSql(sql: string) {
  let index = 0;

  return sql
    .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
    .replace(/\?/g, () => `$${++index}`);
}

export function database() {
  return {
    prepare(sql: string) {
      const query = postgresSql(sql);

      return {
        async run() {
          await ensureSchema();

          const result = await databasePool().query(query);

          return {
            meta: {
              changes: result.rowCount ?? 0,
            },
          };
        },

        bind(...params: unknown[]) {
          return {
            async all<T = Record<string, unknown>>() {
              await ensureSchema();

              const result = await databasePool().query(query, params);

              return {
                results: result.rows as T[],
              };
            },

            async first<T = Record<string, unknown>>() {
              await ensureSchema();

              const result = await databasePool().query(query, params);

              return (result.rows[0] as T | undefined) ?? null;
            },

            async run() {
              await ensureSchema();

              const result = await databasePool().query(query, params);

              return {
                meta: {
                  changes: result.rowCount ?? 0,
                },
              };
            },
          };
        },
      };
    },
  };
}
