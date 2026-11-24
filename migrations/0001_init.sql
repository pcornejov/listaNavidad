-- Personas de la familia (se identifican solo por nombre)
CREATE TABLE people (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Artículos de la lista de cada persona
CREATE TABLE items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  link        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_items_owner ON items(owner_id);

-- Quién regala qué (varias personas pueden regalar el mismo artículo)
CREATE TABLE gifts (
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  giver_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (item_id, giver_id)
);
CREATE INDEX idx_gifts_giver ON gifts(giver_id);
