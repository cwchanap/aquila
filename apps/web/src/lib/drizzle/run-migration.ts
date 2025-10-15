import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

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
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
    }

    console.log('🔗 Connecting to CockroachDB...');
    const sql = postgres(connectionString, {
        ssl: 'require',
        max: 1,
    });

    try {
        // Read the migration file
        const migrationPath = join(
            __dirname,
            'migrations',
            '0000_melodic_dark_beast.sql'
        );
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        console.log('📝 Running migration...');

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
                await sql.unsafe(statement);
                console.log(`  ✅ Statement ${i + 1} completed`);
            } catch (error) {
                const { message, code } = extractDbErrorDetails(error);
                // Ignore errors for "already exists" conditions
                if (
                    (message && message.includes('already exists')) ||
                    code === '42P07' || // duplicate table
                    code === '42710' // duplicate object
                ) {
                    console.log(
                        `  ⚠️  Statement ${i + 1} skipped (already exists)`
                    );
                } else {
                    throw error;
                }
            }
        }

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await sql.end();
    }
}

runMigration();
