import { db } from './db.js'
import type { UserTable, CharacterSetupTable } from './db-types.js'
import type { StoryId } from './story-types.js'

// User operations
export class UserRepository {
  static async create(user: Omit<UserTable, 'created_at' | 'updated_at'>) {
    return await db
      .insertInto('users')
      .values({
        ...user,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  static async findById(id: string) {
    return await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  static async findByEmail(email: string) {
    return await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst()
  }

  static async findByUsername(username: string) {
    return await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst()
  }

  static async update(id: string, updates: Partial<Omit<UserTable, 'id' | 'created_at'>>) {
    return await db
      .updateTable('users')
      .set({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  static async delete(id: string) {
    return await db
      .deleteFrom('users')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  static async list(limit = 50, offset = 0) {
    return await db
      .selectFrom('users')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()
  }
}

// Character setup operations
export class CharacterSetupRepository {
  static async create(setup: {
    userId: string
    characterName: string
    storyId: StoryId
  }) {
    const id = crypto.randomUUID()
    return await db
      .insertInto('characterSetups')
      .values({
        id,
        ...setup,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  static async findByUserAndStory(userId: string, storyId: StoryId) {
    return await db
      .selectFrom('characterSetups')
      .selectAll()
      .where('userId', '=', userId)
      .where('storyId', '=', storyId)
      .executeTakeFirst()
  }

  static async findByUser(userId: string) {
    return await db
      .selectFrom('characterSetups')
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .execute()
  }

  static async update(id: string, updates: Partial<Pick<CharacterSetupTable, 'characterName'>>) {
    return await db
      .updateTable('characterSetups')
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  static async delete(id: string) {
    return await db
      .deleteFrom('characterSetups')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }
}
