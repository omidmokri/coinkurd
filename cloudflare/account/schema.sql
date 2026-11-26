-- entekhab.net account service (Cloudflare D1). Apply with:  npx wrangler d1 execute entekhab-account --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS users      (id TEXT PRIMARY KEY, created INTEGER NOT NULL, rev INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL, label TEXT,
                                       created INTEGER NOT NULL, PRIMARY KEY (provider, subject));
CREATE INDEX IF NOT EXISTS identities_user ON identities(user_id);
CREATE TABLE IF NOT EXISTS passkeys   (cred_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, jwk TEXT NOT NULL, alg INTEGER NOT NULL,
                                       counter INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, last_used INTEGER);
CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys(user_id);
CREATE TABLE IF NOT EXISTS sessions   (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL,
                                       expires INTEGER NOT NULL, seen INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS data       (user_id TEXT NOT NULL, k TEXT NOT NULL, v TEXT, t INTEGER NOT NULL, rev INTEGER NOT NULL,
                                       size INTEGER NOT NULL, PRIMARY KEY (user_id, k));
CREATE INDEX IF NOT EXISTS data_rev ON data(user_id, rev);
CREATE TABLE IF NOT EXISTS flows      (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate       (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL);
