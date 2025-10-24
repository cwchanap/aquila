import * as path from 'path';
import { promises as fs } from 'fs';
import {
    Kysely,
    Migrator,
    FileMigrationProvider,
    PostgresDialect,
} from 'kysely';
import { Pool } from 'pg';

async function migrateToLatest() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not set');
    }

    // Hide password in logs for security
    const safeUrl = databaseUrl.replace(/:[^:@]+@/, ':****@');
    console.log('Using database URL:', safeUrl);

    // Create PostgreSQL connection pool
    const pool = new Pool({
        connectionString: databaseUrl,
        max: 10,
    });

    // Create Kysely instance with PostgreSQL dialect
    const db = new Kysely({
        dialect: new PostgresDialect({ pool }),
    });

    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
            // Point to the TypeScript migration files since tsx can handle them
            migrationFolder: path.join(process.cwd(), 'src/lib/migrations'),
        }),
    });

    console.log('Running migrations...');
    const { error, results } = await migrator.migrateToLatest();

    results?.forEach(it => {
        if (it.status === 'Success') {
            console.log(
                `migration "${it.migrationName}" was executed successfully`
            );
        } else if (it.status === 'Error') {
            console.error(`failed to execute migration "${it.migrationName}"`);
        }
    });

    if (error) {
        console.error('failed to migrate');
        console.error(error);
        process.exit(1);
    }

    console.log('Migration completed successfully!');
    await db.destroy();
}

migrateToLatest().catch(console.error);
