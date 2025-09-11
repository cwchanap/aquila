import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Create users table
    await db.schema
        .createTable('users')
        .addColumn('id', 'text', col => col.primaryKey())
        .addColumn('email', 'text', col => col.notNull().unique())
        .addColumn('username', 'text', col => col.notNull().unique())
        .addColumn('created_at', 'text', col =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
        )
        .addColumn('updated_at', 'text', col =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
        )
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('users').execute();
}
