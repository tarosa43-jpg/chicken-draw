import fs from 'node:fs';
const source = fs.readFileSync('wrangler.toml', 'utf8');
const value = (key) => source.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1];
const root = {
  name: value('name'),
  // wrangler.json is generated inside dist/server, so assets are relative to it.
  assets: { directory: '../client' },
  d1_databases: [{
    binding: value('binding'),
    database_name: value('database_name'),
    database_id: value('database_id'),
      migrations_dir: '../../drizzle',
  }],
};
const path = 'dist/server/wrangler.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
config.compatibility_flags = [...new Set(config.compatibility_flags ?? [])];
config.name = root.name;
config.d1_databases = root.d1_databases;
config.assets = root.assets;
fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
if (root.d1_databases?.some((db) => db.database_id === 'REPLACE_WITH_D1_DATABASE_ID')) {
  console.error('Replace database_id in wrangler.toml before deploying.');
  process.exitCode = 2;
}
