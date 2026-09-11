import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
});
export const presence = sqliteTable(
  'presence',
  {
    code: text('code').notNull(),
    player: text('player').notNull(),
    seen: integer('seen').notNull(),
  },
  (t) => [primaryKey({ columns: [t.code, t.player] })],
);

export const cardHover = sqliteTable('card_hover', {
 code: text('code').primaryKey(), player: text('player').notNull(), serial: integer('serial').notNull(),
 target: text('target'), slot: integer('slot'), seen: integer('seen').notNull(),
});
