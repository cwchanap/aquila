import { eq } from 'drizzle-orm';
import type { PgTable, TableConfig, PgColumn } from 'drizzle-orm/pg-core';
import { db, type DrizzleDB } from './db';

/**
 * Abstract base repository providing common CRUD operations.
 *
 * Subclasses must:
 * - Define the table and idColumn properties
 * - Implement their own create/update methods with proper typing
 *
 * @example
 * ```ts
 * export class UserRepository extends BaseRepository<typeof users, User> {
 *     protected table = users;
 *     protected idColumn = users.id;
 *
 *     async create(data: NewUser) {
 *         // Implementation
 *     }
 * }
 * ```
 */
export abstract class BaseRepository<
    TTable extends PgTable<TableConfig>,
    TSelect,
> {
    protected db: DrizzleDB;
    protected abstract table: TTable;
    protected abstract idColumn: PgColumn;

    constructor(dbInstance?: DrizzleDB) {
        this.db = dbInstance || db;
    }

    /**
     * Find a record by its primary key ID.
     */
    async findById(id: string): Promise<TSelect | undefined> {
        const [result] = await this.db
            .select()
            .from(this.table)
            .where(eq(this.idColumn, id))
            .limit(1);
        return result as TSelect | undefined;
    }

    /**
     * Delete a record by its primary key ID.
     * @returns true if a record was deleted, false otherwise
     */
    async delete(id: string): Promise<boolean> {
        const deleted = await this.db
            .delete(this.table)
            .where(eq(this.idColumn, id))
            .returning({ id: this.idColumn });
        return deleted.length > 0;
    }
}
