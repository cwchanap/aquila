import { Kysely, sql } from 'kysely';
import type { Database } from '../db-types.js';

export async function up(db: Kysely<Database>): Promise<void> {
    // Recreate accounts table to fix unique constraint to (providerId, accountId)
    await sql`
    CREATE TABLE accounts_new (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT,
      scope TEXT,
      password TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(providerId, accountId)
    )
  `.execute(db);

    await sql`
    INSERT INTO accounts_new (
      id, userId, accountId, providerId, accessToken, refreshToken, idToken,
      accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt
    )
    SELECT 
      id, userId, accountId, providerId, accessToken, refreshToken, idToken,
      accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt
    FROM accounts
  `.execute(db);

    await sql`DROP TABLE accounts`.execute(db);
    await sql`ALTER TABLE accounts_new RENAME TO accounts`.execute(db);

    // Recreate index on userId (was dropped with the table)
    await sql`CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts(userId)`.execute(
        db
    );
}

export async function down(db: Kysely<Database>): Promise<void> {
    // Revert accounts table to previous unique constraint (userId, providerId)
    await sql`
    CREATE TABLE accounts_old (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT,
      scope TEXT,
      password TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, providerId)
    )
  `.execute(db);

    await sql`
    INSERT INTO accounts_old (
      id, userId, accountId, providerId, accessToken, refreshToken, idToken,
      accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt
    )
    SELECT 
      id, userId, accountId, providerId, accessToken, refreshToken, idToken,
      accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt
    FROM accounts
  `.execute(db);

    await sql`DROP TABLE accounts`.execute(db);
    await sql`ALTER TABLE accounts_old RENAME TO accounts`.execute(db);

    // Recreate index on userId
    await sql`CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts(userId)`.execute(
        db
    );
}
