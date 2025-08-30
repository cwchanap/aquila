import { db } from './db.js'
import type { UserTable } from './db-types.js'

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
