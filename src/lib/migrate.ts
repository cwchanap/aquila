import { promises as fs } from 'fs';
import { FileMigrationProvider, Migrator } from 'kysely';
import * as path from 'path';
import { db } from './db.js';

console.log('=== MIGRATE SCRIPT STARTING ===');
console.log('Process args:', process.argv);
console.log('Current working directory:', process.cwd());
console.log('URL from env:', process.env.TURSO_DATABASE_URL);

export async function migrateToLatest() {
    console.log('Starting migration...');

    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
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

export async function migrateDown() {
    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(process.cwd(), 'src/lib/migrations'),
        }),
    });

    const { error, results } = await migrator.migrateDown();

    results?.forEach(it => {
        if (it.status === 'Success') {
            console.log(
                `migration "${it.migrationName}" was reverted successfully`
            );
        } else if (it.status === 'Error') {
            console.error(`failed to revert migration "${it.migrationName}"`);
        }
    });

    if (error) {
        console.error('failed to migrate');
        console.error(error);
        process.exit(1);
    }

    await db.destroy();
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateToLatest();
}
