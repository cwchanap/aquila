import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { resolveSsl, resolveConnectionString } from './connection';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env
config({ path: join(__dirname, '../../../.env') });

function extractDbErrorDetails(error: unknown): {
    message?: string;
    code?: string;
} {
    if (typeof error === 'object' && error !== null) {
        const record = error as Record<string, unknown>;
        const message =
            typeof record.message === 'string' ? record.message : undefined;
        const code = typeof record.code === 'string' ? record.code : undefined;
        return { message, code };
    }
    return {};
}

async function runMigration() {
    // Use the shared fallback chain (DATABASE_URL → POSTGRES_URL →
    // aquila_DATABASE_URL → aquila_POSTGRES_URL) so this runner works in
    // Vercel environments that only provision a prefixed var. Matches the
    // resolution used by db.ts and the drizzle-migrate-safe wrapper.
    const connectionString = resolveConnectionString();

    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
    }

    console.log('🔗 Connecting to Postgres...');

    const ssl = resolveSsl(connectionString);

    const pool = new Pool({
        connectionString,
        ssl,
        max: 1,
    });

    try {
        // Get all migration files and sort them
        const migrationsDir = join(__dirname, 'migrations');
        const migrationFiles = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Sorts alphabetically: 0000_..., 0001_..., etc.

        if (migrationFiles.length === 0) {
            console.log('⚠️  No migration files found');
            return;
        }

        console.log(`📝 Found ${migrationFiles.length} migration file(s)`);

        // Ensure migration tracking table exists
        const trackingTableName = 'drizzle_migrations_audit';
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${trackingTableName} (
                id SERIAL PRIMARY KEY,
                file_name TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

        // Run each migration file in order
        for (const migrationFile of migrationFiles) {
            console.log(`\n🔄 Running migration: ${migrationFile}`);
            const migrationPath = join(migrationsDir, migrationFile);
            const migrationSQL = readFileSync(migrationPath, 'utf-8');

            const { rows: alreadyApplied } = await pool.query(
                `SELECT 1 FROM ${trackingTableName} WHERE file_name = $1 LIMIT 1`,
                [migrationFile]
            );

            if (alreadyApplied.length > 0) {
                console.log(
                    `  ⏭️  Skipping ${migrationFile} (previously applied)`
                );
                continue;
            }

            // Split by statement-breakpoint and execute each statement
            const statements = migrationSQL
                .split('--> statement-breakpoint')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                console.log(
                    `  [${i + 1}/${statements.length}] Executing statement...`
                );
                try {
                    await pool.query(statement);
                    console.log(`  ✅ Statement ${i + 1} completed`);
                } catch (error) {
                    const { code, message } = extractDbErrorDetails(error);
                    if (
                        code === '42P07' ||
                        code === '42710' ||
                        code === '42P16' ||
                        (message && message.includes('already exists'))
                    ) {
                        throw new Error(
                            `Duplicate object detected while applying ${migrationFile} (statement ${i + 1}). ` +
                                'This migration is not recorded as applied and may indicate schema drift. ' +
                                'Verify the database state and update the migration tracking table if necessary.'
                        );
                    }

                    throw error;
                }
            }

            console.log(`✅ Migration ${migrationFile} completed`);
            await pool.query(
                `INSERT INTO ${trackingTableName} (file_name) VALUES ($1) ON CONFLICT (file_name) DO NOTHING`,
                [migrationFile]
            );
        }

        console.log('\n🎉 All migrations completed successfully!');
    } catch (error) {
        const { message, code } = extractDbErrorDetails(error);
        console.error(
            '❌ Migration failed:',
            code ? `[${code}]` : '',
            message ?? 'unknown error'
        );
        // Rethrow a sanitized error so the unhandled-rejection printout
        // doesn't leak the connection string a raw pg error may carry.
        throw new Error(
            `Migration failed${code ? ` [${code}]` : ''}: ${message ?? 'unknown error'}`
        );
    } finally {
        await pool.end();
    }
}

runMigration();
