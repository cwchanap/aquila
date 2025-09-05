import { createClient } from '@libsql/client'
import { Kysely } from 'kysely'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import type { Database } from './db-types'

// Get environment variables
const url = process.env.TURSO_DATABASE_URL ?? 'http://127.0.0.1:8080'
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  throw new Error('TURSO_DATABASE_URL is not set. For local development, use http://127.0.0.1:8080')
}

// Create the database client
const client = createClient({
  url,
  authToken,
})

// Create Kysely instance
export const db = new Kysely<Database>({
  dialect: new LibsqlDialect({
    client,
  }),
})

export type { Database }
