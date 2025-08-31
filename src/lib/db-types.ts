// Database schema types for Kysely
import type { StoryId } from './story-types.js'

export interface Database {
  users: UserTable
  sessions: SessionTable
  accounts: AccountTable
  verificationTokens: VerificationTokenTable
  characterSetups: CharacterSetupTable
}

export interface UserTable {
  id: string
  email: string
  username: string | null
  name: string | null
  image: string | null
  emailVerified: string | null
  createdAt: string
  updatedAt: string
}

export interface SessionTable {
  id: string
  userId: string
  expiresAt: string
  token: string
  createdAt: string
  updatedAt: string
  ipAddress: string | null
  userAgent: string | null
}

export interface AccountTable {
  id: string
  userId: string
  accountId: string
  providerId: string
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  accessTokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  scope: string | null
  password: string | null
  createdAt: string
  updatedAt: string
}

export interface VerificationTokenTable {
  id: string
  identifier: string
  token: string
  expires: string
  createdAt: string
  updatedAt: string
}

export interface CharacterSetupTable {
  id: string
  userId: string
  characterName: string
  storyId: StoryId
  createdAt: string
  updatedAt: string
}
