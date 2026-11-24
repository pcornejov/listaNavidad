-- Completa name_key en personas creadas sin ella (p. ej. durante el despliegue de 0002).
UPDATE people SET name_key = lower(trim(name)) WHERE name_key IS NULL;
