import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw Error('対戦サーバーに接続できません');
  return env.DB;
}
