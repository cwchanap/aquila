/**
 * Simple auth service as fallback for better-auth issues.
 * NOT recommended for production use - prefer better-auth for production deployments.
 *
 * Uses bcrypt for password hashing and session-based authentication.
 * All errors are thrown (not silently swallowed) for proper error handling.
 */
import bcrypt from 'bcryptjs';
import { db } from './drizzle/db.js';
import { users, accounts, sessions } from './drizzle/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { logger } from './logger.js';
import { ERROR_IDS } from '../constants/errorIds.js';
import {
    UserAlreadyExistsError,
    PasswordHashError,
    DatabaseError,
} from './errors.js';

export interface SimpleUser {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
}

export interface SimpleSession {
    user: SimpleUser;
    sessionId: string;
}

export class SimpleAuthService {
    /**
     * Sign up a new user with email and password.
     *
     * @throws {UserAlreadyExistsError} If email already exists (case-insensitive)
     * @throws {PasswordHashError} If password hashing fails
     * @throws {DatabaseError} If user/account creation fails
     */
    static async signUp(
        email: string,
        password: string,
        name: string
    ): Promise<SimpleUser> {
        // Normalize email to lowercase for consistent storage and comparison
        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists (case-insensitive via normalization)
        const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        if (existingUser) {
            throw new UserAlreadyExistsError();
        }

        // Hash password with bcrypt (10 rounds)
        let hashedPassword: string;
        try {
            hashedPassword = await bcrypt.hash(password, 10);
        } catch (error) {
            logger.error('Password hashing failed during signup', error, {
                errorId: ERROR_IDS.AUTH_PASSWORD_HASH_FAILED,
                email: normalizedEmail.substring(0, 3) + '***',
            });
            throw new PasswordHashError();
        }

        // Create user and account in atomic transaction
        const userId = crypto.randomUUID();
        try {
            await db.transaction(async tx => {
                await tx.insert(users).values({
                    id: userId,
                    email: normalizedEmail,
                    name,
                    username: null,
                    image: null,
                    emailVerified: false,
                });

                await tx.insert(accounts).values({
                    id: crypto.randomUUID(),
                    userId,
                    accountId: normalizedEmail,
                    providerId: 'email',
                    password: hashedPassword,
                    accessToken: null,
                    refreshToken: null,
                    idToken: null,
                    accessTokenExpiresAt: null,
                    refreshTokenExpiresAt: null,
                    scope: null,
                });
            });
        } catch (error) {
            if (isEmailUniqueViolation(error)) {
                throw new UserAlreadyExistsError();
            }
            logger.error('User creation transaction failed', error, {
                errorId: ERROR_IDS.AUTH_SIGNUP_FAILED,
                email: normalizedEmail.substring(0, 3) + '***',
                userId,
            });
            throw new DatabaseError('Failed to create user account');
        }

        return {
            id: userId,
            email: normalizedEmail,
            name,
            username: null,
        };
    }

    /**
     * Sign in a user with email and password.
     *
     * @returns SimpleUser if credentials are valid, null if invalid
     *
     * Note: Returns null for both "user not found" and "wrong password" to prevent
     * timing attacks and user enumeration.
     */
    static async signIn(
        email: string,
        password: string
    ): Promise<SimpleUser | null> {
        // Normalize email to lowercase for consistent comparison
        const normalizedEmail = email.trim().toLowerCase();

        // Find user by email (case-insensitive via normalization)
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        if (!user) {
            // User not found - this is a valid authentication failure
            return null;
        }

        // Find account with password
        const [account] = await db
            .select()
            .from(accounts)
            .where(
                and(
                    eq(accounts.userId, user.id),
                    eq(accounts.providerId, 'email')
                )
            )
            .limit(1);

        if (!account || !account.password) {
            // Account not found or no password set - this is a valid authentication failure
            return null;
        }

        // Verify password against hashed value using bcrypt constant-time comparison
        const isValid = await bcrypt.compare(password, account.password);

        if (!isValid) {
            // Invalid password - this is a valid authentication failure
            return null;
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
        };
    }

    /**
     * Create a new session for an authenticated user.
     *
     * @throws {DatabaseError} If session creation fails
     */
    static async createSession(user: SimpleUser): Promise<string> {
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.insert(sessions).values({
            id: sessionId,
            userId: user.id,
            token: crypto.randomUUID(),
            expiresAt,
            ipAddress: null,
            userAgent: null,
        });

        return sessionId;
    }

    /**
     * Retrieve and validate a session by ID.
     *
     * @returns SimpleSession if valid and not expired, null if not found or expired
     */
    static async getSession(sessionId: string): Promise<SimpleSession | null> {
        const result = await db
            .select({
                sessionId: sessions.id,
                expiresAt: sessions.expiresAt,
                userId: users.id,
                email: users.email,
                name: users.name,
                username: users.username,
            })
            .from(sessions)
            .innerJoin(users, eq(users.id, sessions.userId))
            .where(
                and(
                    eq(sessions.id, sessionId),
                    gt(sessions.expiresAt, new Date())
                )
            )
            .limit(1);

        const session = result[0];
        if (!session) {
            // Session not found or expired - this is a valid case
            return null;
        }

        return {
            user: {
                id: session.userId,
                email: session.email,
                name: session.name,
                username: session.username,
            },
            sessionId: session.sessionId,
        };
    }

    /**
     * Delete a session (logout).
     *
     * Important: Errors from this operation will propagate to the caller.
     * The caller should handle failures appropriately (e.g., show error to user).
     */
    static async deleteSession(sessionId: string): Promise<void> {
        await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
}

const EMAIL_UNIQUE_CONSTRAINTS = new Set([
    'users_email_unique',
    'users_email_key',
    'users_email_unique_idx',
    'users_email_unique_index',
]);

function isEmailUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const err = error as {
        code?: string;
        constraint?: string;
        detail?: string;
        message?: string;
    };
    if (err.code === '23505' && err.constraint) {
        return EMAIL_UNIQUE_CONSTRAINTS.has(err.constraint);
    }
    const detail = err.detail ?? err.message ?? '';
    return (
        err.code === '23505' &&
        typeof detail === 'string' &&
        detail.includes('users_email')
    );
}
