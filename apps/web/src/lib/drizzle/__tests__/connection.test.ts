import { describe, it, expect } from 'vitest';
import { resolveConnectionString, resolveSsl } from '../connection';

describe('resolveConnectionString', () => {
    it('prefers DATABASE_URL above all', () => {
        expect(
            resolveConnectionString({
                DATABASE_URL: 'postgres://a/db',
                POSTGRES_URL: 'postgres://b/db',
                aquila_DATABASE_URL: 'postgres://c/db',
            } as NodeJS.ProcessEnv)
        ).toBe('postgres://a/db');
    });

    it('falls back to POSTGRES_URL when DATABASE_URL is unset', () => {
        expect(
            resolveConnectionString({
                POSTGRES_URL: 'postgres://b/db',
            } as NodeJS.ProcessEnv)
        ).toBe('postgres://b/db');
    });

    it('falls back to aquila_DATABASE_URL then aquila_POSTGRES_URL', () => {
        expect(
            resolveConnectionString({
                aquila_DATABASE_URL: 'postgres://c/db',
            } as NodeJS.ProcessEnv)
        ).toBe('postgres://c/db');
        expect(
            resolveConnectionString({
                aquila_POSTGRES_URL: 'postgres://d/db',
            } as NodeJS.ProcessEnv)
        ).toBe('postgres://d/db');
    });

    it('returns undefined when none are set or all empty', () => {
        expect(
            resolveConnectionString({} as NodeJS.ProcessEnv)
        ).toBeUndefined();
        expect(
            resolveConnectionString({ DATABASE_URL: '' } as NodeJS.ProcessEnv)
        ).toBeUndefined();
    });
});

describe('resolveSsl', () => {
    const local = 'postgres://localhost:5432/aquila';
    const remote = 'postgres://u:p@db.prisma.io:5432/postgres';
    const remoteSslMode =
        'postgres://u:p@db.prisma.io:5432/postgres?sslmode=require';

    it('returns false for a local host in dev with no flags', () => {
        expect(
            resolveSsl(local, { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
        ).toBe(false);
    });

    it('returns false for bracketed IPv6 loopback [::1]', () => {
        expect(
            resolveSsl('postgres://user:pass@[::1]:5432/db', {
                NODE_ENV: 'test',
            } as NodeJS.ProcessEnv)
        ).toBe(false);
    });

    it('enables verifying SSL for a remote host even outside production', () => {
        expect(
            resolveSsl(remote, { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
        ).toEqual({ rejectUnauthorized: true });
    });

    it('enables verifying SSL when the string carries sslmode=require', () => {
        expect(
            resolveSsl(remoteSslMode, { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
        ).toEqual({ rejectUnauthorized: true });
    });

    it('enables verifying SSL in production for a local host', () => {
        expect(
            resolveSsl(local, { NODE_ENV: 'production' } as NodeJS.ProcessEnv)
        ).toEqual({ rejectUnauthorized: true });
    });

    it('disables verification when DB_ALLOW_SELF_SIGNED=true (even local/dev)', () => {
        expect(
            resolveSsl(local, {
                NODE_ENV: 'development',
                DB_ALLOW_SELF_SIGNED: 'true',
            } as NodeJS.ProcessEnv)
        ).toEqual({ rejectUnauthorized: false });
    });
});
