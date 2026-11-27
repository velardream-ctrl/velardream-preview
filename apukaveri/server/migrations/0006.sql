ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT '🤝';
UPDATE categories SET icon = CASE id
  WHEN 1 THEN '🧸'
  WHEN 2 THEN '👵'
  WHEN 3 THEN '🐕'
  WHEN 4 THEN '🐈'
  WHEN 5 THEN '🛍️'
  WHEN 6 THEN '📦'
  WHEN 7 THEN '🚗'
  WHEN 8 THEN '🙋'
  WHEN 9 THEN '🍲'
  WHEN 10 THEN '🧹'
  WHEN 11 THEN '🌱'
  WHEN 12 THEN '💻'
  WHEN 13 THEN '🤝'
  ELSE icon END;
