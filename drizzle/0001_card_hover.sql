CREATE TABLE IF NOT EXISTS card_hover (
  code TEXT PRIMARY KEY NOT NULL,
  player TEXT NOT NULL,
  serial INTEGER NOT NULL,
  target TEXT,
  slot INTEGER,
  seen INTEGER NOT NULL
);
