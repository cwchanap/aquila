import { Kysely, sql } from 'kysely'
import type { Database } from '../db-types.js'

export async function up(db: Kysely<Database>): Promise<void> {
  // Create character_setups table
  await sql`
    CREATE TABLE characterSetups (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      characterName TEXT NOT NULL,
      storyId TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, storyId)
    )
  `.execute(db)

  // Create indexes for better performance
  await sql`CREATE INDEX idx_character_setups_userId ON characterSetups(userId)`.execute(db)
  await sql`CREATE INDEX idx_character_setups_storyId ON characterSetups(storyId)`.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop the character_setups table
  await sql`DROP TABLE IF EXISTS characterSetups`.execute(db)
}
