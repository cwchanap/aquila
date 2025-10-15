import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres connection
const client = postgres(connectionString, {
    ssl: 'require',
    max: 10,
});

// Create and export Drizzle DB instance
export const db = drizzle(client, { schema });

// Type export
export type DrizzleDB = typeof db;
