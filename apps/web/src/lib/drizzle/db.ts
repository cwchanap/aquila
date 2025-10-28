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

        const isProduction = process.env.NODE_ENV === 'production';
        const allowSelfSigned = process.env.DB_ALLOW_SELF_SIGNED === 'true';
        const poolMaxEnv = process.env.DB_POOL_MAX;
        const parsedPoolMax = poolMaxEnv
            ? Number.parseInt(poolMaxEnv, 10)
            : NaN;
        const poolMax =
            !Number.isNaN(parsedPoolMax) && parsedPoolMax > 0
                ? parsedPoolMax
                : 10;

        let ssl: boolean | { rejectUnauthorized: boolean } = false;
        if (isProduction) {
            ssl = { rejectUnauthorized: !allowSelfSigned };
        } else if (allowSelfSigned) {
            ssl = { rejectUnauthorized: false };
        }

        // Create PostgreSQL connection pool
        const pool = new Pool({
            connectionString,
            ssl,
            max: poolMax,
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
