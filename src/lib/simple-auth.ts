// Simple auth service as fallback for better-auth issues
import { db } from './db.js'
import bcrypt from 'bcryptjs'

export interface SimpleUser {
  id: string
  email: string
  name: string | null
  username: string | null
}

export interface SimpleSession {
  user: SimpleUser
  sessionId: string
}

export class SimpleAuthService {
  static async signUp(email: string, password: string, name: string): Promise<SimpleUser | null> {
    try {
      // Check if user already exists
      const existingUser = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst()

      if (existingUser) {
        throw new Error('User already exists')
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Create user
      const userId = crypto.randomUUID()
      await db
        .insertInto('users')
        .values({
          id: userId,
          email,
          name,
          username: null,
          image: null,
          emailVerified: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .execute()

      // Create account with password
      await db
        .insertInto('accounts')
        .values({
          id: crypto.randomUUID(),
          userId,
          accountId: email,
          providerId: 'email',
          password: hashedPassword,
          accessToken: null,
          refreshToken: null,
          idToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .execute()

      return {
        id: userId,
        email,
        name,
        username: null,
      }
    } catch (error) {
      console.error('Signup error:', error)
      return null
    }
  }

  static async signIn(email: string, password: string): Promise<SimpleUser | null> {
    try {
      // Find user
      const user = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst()

      if (!user) {
        return null
      }

      // Find account with password
      const account = await db
        .selectFrom('accounts')
        .selectAll()
        .where('userId', '=', user.id)
        .where('providerId', '=', 'email')
        .executeTakeFirst()

      if (!account || !account.password) {
        return null
      }

      // Check password
      const isValid = await bcrypt.compare(password, account.password)
      if (!isValid) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
      }
    } catch (error) {
      console.error('Signin error:', error)
      return null
    }
  }

  static async createSession(user: SimpleUser): Promise<string> {
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

    await db
      .insertInto('sessions')
      .values({
        id: sessionId,
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ipAddress: null,
        userAgent: null,
      })
      .execute()

    return sessionId
  }

  static async getSession(sessionId: string): Promise<SimpleSession | null> {
    try {
      const session = await db
        .selectFrom('sessions')
        .innerJoin('users', 'users.id', 'sessions.userId')
        .select([
          'sessions.id as sessionId',
          'sessions.expiresAt',
          'users.id',
          'users.email',
          'users.name',
          'users.username',
        ])
        .where('sessions.id', '=', sessionId)
        .where('sessions.expiresAt', '>', new Date().toISOString())
        .executeTakeFirst()

      if (!session) {
        return null
      }

      return {
        user: {
          id: session.id,
          email: session.email,
          name: session.name,
          username: session.username,
        },
        sessionId: session.sessionId,
      }
    } catch (error) {
      console.error('Get session error:', error)
      return null
    }
  }

  static async deleteSession(sessionId: string): Promise<void> {
    try {
      await db
        .deleteFrom('sessions')
        .where('id', '=', sessionId)
        .execute()
    } catch (error) {
      console.error('Delete session error:', error)
    }
  }
}
