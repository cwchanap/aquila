import * as path from 'path';
import { promises as fs } from 'fs';
import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { LibsqlDialect } from '@libsql/kysely-libsql';
import { createClient } from '@libsql/client';

async function migrateToLatest() {
    const url = process.env.TURSO_DATABASE_URL ?? 'http://127.0.0.1:5091';
    console.log('Using database URL:', url);

    // Create the database client
    const client = createClient({ url });

    // Create Kysely instance
    const db = new Kysely({
        dialect: new LibsqlDialect({ client }),
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
