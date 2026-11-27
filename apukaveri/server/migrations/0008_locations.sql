CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL UNIQUE,
  fi TEXT NOT NULL,
  ru TEXT NOT NULL,
  en TEXT NOT NULL,
  timezone TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1))
);

INSERT INTO locations (id, country, region, city, fi, ru, en, timezone, active) VALUES
  ('FI-260', 'FI', 'FI-13', 'Kitee', 'Kitee', 'Китеэ', 'Kitee', 'Europe/Helsinki', 1),
  ('FI-167', 'FI', 'FI-13', 'Joensuu', 'Joensuu', 'Йоэнсуу', 'Joensuu', 'Europe/Helsinki', 1),
  ('FI-091', 'FI', 'FI-18', 'Helsinki', 'Helsinki', 'Хельсинки', 'Helsinki', 'Europe/Helsinki', 1),
  ('FI-638', 'FI', 'FI-18', 'Porvoo', 'Porvoo', 'Порвоо', 'Porvoo', 'Europe/Helsinki', 0);
