-- Varios links de ejemplo por regalo (arreglo JSON). La columna "link" queda como respaldo.
ALTER TABLE items ADD COLUMN links TEXT NOT NULL DEFAULT '[]';
UPDATE items SET links = json_array(link) WHERE link != '';
