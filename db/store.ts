import pg from 'pg';

const { Pool } = pg;
let pool: pg.Pool | null = null;
let schemaReady: Promise<void> | null = null;
const localRooms = new Map<string, { state: string; version: number }>();
const localPresence = new Map<string, { player: string; seen: number }>();
const localHover = new Map<string, { player: string; serial: number; target: string | null; slot: number | null; seen: number }>();

function databasePool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw Error('DATABASE_URLが設定されていません');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 10 });
  }
  return pool;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = databasePool().query(`
      CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS presence (code TEXT NOT NULL, player TEXT NOT NULL, seen BIGINT NOT NULL, PRIMARY KEY (code, player));
      CREATE TABLE IF NOT EXISTS card_hover (code TEXT PRIMARY KEY, player TEXT NOT NULL, serial INTEGER NOT NULL, target TEXT, slot INTEGER, seen BIGINT NOT NULL);
    `).then(() => undefined);
  }
  return schemaReady;
}

function postgresSql(sql: string) {
  let n = 0;
  return sql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO').replace(/\?/g, () => `$${++n}`);
}

function localDatabase() {
  return {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      return {
        async run() {
          return { meta: { changes: 0 } };
        },
        bind(...params: unknown[]) {
          return {
            async all<T = Record<string, unknown>>() {
              if (normalized.startsWith('select player, seen from presence')) {
                const code = String(params[0]);
                return {
                  results: [...localPresence.entries()]
                    .filter(([key]) => key.startsWith(code + ':'))
                    .map(([, value]) => value) as T[],
                };
              }
              return { results: [] as T[] };
            },
            async first<T = Record<string, unknown>>() {
              const key = String(params[0]);
              if (normalized.startsWith('select state, version from rooms'))
                return (localRooms.get(key) as T | undefined) ?? null;
              if (normalized.startsWith('select player as by, serial, target, slot, seen from card_hover'))
                return (localHover.get(key) as T | undefined) ?? null;
              return null;
            },
            async run() {
              if (normalized.startsWith('insert into rooms')) {
                const code = String(params[0]);
                if (localRooms.has(code)) return { meta: { changes: 0 } };
                localRooms.set(code, { state: String(params[1]), version: 0 });
                return { meta: { changes: 1 } };
              }
              if (normalized.startsWith('update rooms set state')) {
                const code = String(params[1]);
                const expected = Number(params[2]);
                const room = localRooms.get(code);
                if (!room || room.version !== expected) return { meta: { changes: 0 } };
                room.state = String(params[0]);
                room.version++;
                return { meta: { changes: 1 } };
              }
              if (normalized.startsWith('insert into presence')) {
                localPresence.set(`${String(params[0])}:${String(params[1])}`, { player: String(params[1]), seen: Number(params[2]) });
                return { meta: { changes: 1 } };
              }
              if (normalized.startsWith('insert into card_hover')) {
                localHover.set(String(params[0]), { player: String(params[1]), serial: Number(params[2]), target: params[3] == null ? null : String(params[3]), slot: params[4] == null ? null : Number(params[4]), seen: Number(params[5]) });
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

export function database() {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') throw Error('DATABASE_URLが設定されていません');
    return localDatabase();
  }
  return {
    prepare(sql: string) {
      const query = postgresSql(sql);
      return {
        async run() {
          await ensureSchema();
          const result = await databasePool().query(query);
          return { meta: { changes: result.rowCount ?? 0 } };
        },
        bind(...params: unknown[]) {
          return {
            async all<T = Record<string, unknown>>() {
              await ensureSchema();
              const result = await databasePool().query(query, params);
              return { results: result.rows as T[] };
            },
            async first<T = Record<string, unknown>>() {
              await ensureSchema();
              const result = await databasePool().query(query, params);
              return (result.rows[0] as T | undefined) ?? null;
            },
            async run() {
              await ensureSchema();
              const result = await databasePool().query(query, params);
              return { meta: { changes: result.rowCount ?? 0 } };
            },
          };
        },
      };
    },
  };
}
