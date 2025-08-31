import { Kysely, sql } from 'kysely'
import type { Database } from '../db-types.js'

export async function up(db: Kysely<Database>): Promise<void> {
  // Update users table to match better-auth schema
  await sql`
    CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT,
      name TEXT,
      image TEXT,
      emailVerified TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `.execute(db)

  // Copy existing data
  await sql`
    INSERT INTO users_new (id, email, username, name, createdAt, updatedAt)
    SELECT id, email, username, username, created_at, updated_at FROM users
  `.execute(db)

  // Drop old table and rename new one
  await sql`DROP TABLE users`.execute(db)
  await sql`ALTER TABLE users_new RENAME TO users`.execute(db)

  // Create sessions table
  await sql`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      ipAddress TEXT,
      userAgent TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `.execute(db)

  // Create accounts table
  await sql`
    CREATE TABLE accounts (
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
  `.execute(db)

  // Create verification tokens table
  await sql`
    CREATE TABLE verificationTokens (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `.execute(db)

  // Create indexes for better performance
  await sql`CREATE INDEX idx_sessions_userId ON sessions(userId)`.execute(db)
  await sql`CREATE INDEX idx_sessions_token ON sessions(token)`.execute(db)
  await sql`CREATE INDEX idx_accounts_userId ON accounts(userId)`.execute(db)
  await sql`CREATE INDEX idx_verification_token ON verificationTokens(token)`.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop the new tables
  await sql`DROP TABLE IF EXISTS verificationTokens`.execute(db)
  await sql`DROP TABLE IF EXISTS accounts`.execute(db)
  await sql`DROP TABLE IF EXISTS sessions`.execute(db)

  // Restore original users table structure
  await sql`
    CREATE TABLE users_old (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `.execute(db)

  // Copy data back
  await sql`
    INSERT INTO users_old (id, email, username, created_at, updated_at)
    SELECT id, email, COALESCE(username, name, 'user'), createdAt, updatedAt FROM users
  `.execute(db)

  // Replace users table
  await sql`DROP TABLE users`.execute(db)
  await sql`ALTER TABLE users_old RENAME TO users`.execute(db)
}
