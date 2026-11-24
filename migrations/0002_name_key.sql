-- Clave normalizada del nombre (sin mayúsculas, tildes ni espacios extra)
-- para que "Pablo", "pablo" y " PABLO " sean la misma persona.
ALTER TABLE people ADD COLUMN name_key TEXT;
UPDATE people SET name_key = lower(trim(name));
CREATE UNIQUE INDEX idx_people_name_key ON people(name_key);
