CREATE TABLE registration_terms (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('fi', 'en', 'ru')),
  accepted_at INTEGER NOT NULL DEFAULT (unixepoch())
);
