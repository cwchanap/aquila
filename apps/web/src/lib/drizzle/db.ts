import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Lazy-load db instance to avoid loading before env vars are available
let _db: NodePgDatabase<typeof schema> | null = null;

function getDb() {
    if (!_db) {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        // Create PostgreSQL connection pool
        const pool = new Pool({
            connectionString,
            ssl:
                process.env.NODE_ENV === 'production'
                    ? { rejectUnauthorized: false }
                    : false,
            max: 10,
        });

        // Create Drizzle DB instance
        _db = drizzle(pool, { schema });
    }

    return _db;
}

// Export db instance via getter
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
    get(_, prop) {
        const dbInstance = getDb();
        return dbInstance[prop as keyof typeof dbInstance];
    },
});

// Type export
export type DrizzleDB = NodePgDatabase<typeof schema>;
