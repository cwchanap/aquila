// Simple auth service as fallback for better-auth issues
import bcrypt from 'bcryptjs';
import { db } from './drizzle/db.js';
import { users, accounts, sessions } from './drizzle/schema.js';
import { eq, and, gt, ilike } from 'drizzle-orm';

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
    static async signUp(
        email: string,
        password: string,
        name: string
    ): Promise<SimpleUser | null> {
        try {
            const trimmedEmail = email.trim();

            // Check if user already exists
            const [existingUser] = await db
                .select()
                .from(users)
                .where(ilike(users.email, trimmedEmail))
                .limit(1);

            if (existingUser) {
                throw new Error('User already exists');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const userId = crypto.randomUUID();
            await db.transaction(async tx => {
                await tx.insert(users).values({
                    id: userId,
                    email: trimmedEmail,
                    name,
                    username: null,
                    image: null,
                    emailVerified: false,
                });

                await tx.insert(accounts).values({
                    id: crypto.randomUUID(),
                    userId,
                    accountId: trimmedEmail,
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

            return {
                id: userId,
                email: trimmedEmail,
                name,
                username: null,
            };
        } catch (error) {
            console.error('Signup error:', error);
            return null;
        }
    }

    static async signIn(
        email: string,
        password: string
    ): Promise<SimpleUser | null> {
        try {
            const trimmedEmail = email.trim();

            // Find user
            const [user] = await db
                .select()
                .from(users)
                .where(ilike(users.email, trimmedEmail))
                .limit(1);

            if (!user) {
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
                return null;
            }

            // Check password
            const isValid = await bcrypt.compare(password, account.password);
            if (!isValid) {
                return null;
            }

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                username: user.username,
            };
        } catch (error) {
            console.error('Signin error:', error);
            return null;
        }
    }

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

    static async getSession(sessionId: string): Promise<SimpleSession | null> {
        try {
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
        } catch (error) {
            console.error('Get session error:', error);
            return null;
        }
    }

    static async deleteSession(sessionId: string): Promise<void> {
        try {
            await db.delete(sessions).where(eq(sessions.id, sessionId));
        } catch (error) {
            console.error('Delete session error:', error);
        }
    }
}
