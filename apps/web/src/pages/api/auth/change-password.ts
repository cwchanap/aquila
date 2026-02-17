import type { APIRoute } from 'astro';
import { db } from '../../../lib/drizzle/db.js';
import { accounts } from '../../../lib/drizzle/schema.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logger } from '../../../lib/logger.js';
import {
    jsonResponse,
    errorResponse,
    requireAuth,
} from '../../../lib/api-utils.js';
import { ERROR_IDS } from '../../../constants/errorIds.js';

const MAX_PASSWORD_LENGTH = 256;

// In-memory rate limiter for password change attempts
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60_000; // 15 minutes

interface RateLimitEntry {
    attempts: number;
    windowStart: number;
    lockedUntil?: number;
    lastSeen: number; // Timestamp for cleanup
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// TTL for rate limit entries (30 minutes)
const ENTRY_TTL_MS = 30 * 60_000;

/**
 * Periodic cleanup task to remove stale entries from the rate limit map.
 * NOTE: This in-memory rate limiter is NOT suitable for multi-instance production deployments.
 * For production, consider using a distributed store like Redis to share rate limit state
 * across all instances.
 */
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of rateLimitMap.entries()) {
        // Remove entries that haven't been updated in the TTL period
        if (now - entry.lastSeen > ENTRY_TTL_MS) {
            rateLimitMap.delete(userId);
        }
    }
}, 60_000); // Run cleanup every minute

// Clear interval on process shutdown (guarded for serverless/edge runtimes)
if (typeof process !== 'undefined' && typeof process.on === 'function') {
    const clearCleanup = () => clearInterval(cleanupInterval);
    process.on('beforeExit', clearCleanup);
    process.on('SIGTERM', clearCleanup);
    process.on('SIGINT', clearCleanup);
}

function checkRateLimit(userId: string): {
    allowed: boolean;
    retryAfterSeconds?: number;
} {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (entry?.lockedUntil && now < entry.lockedUntil) {
        entry.lastSeen = now;
        return {
            allowed: false,
            retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
        };
    }

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(userId, {
            attempts: 1,
            windowStart: now,
            lastSeen: now,
        });
        return { allowed: true };
    }

    if (entry.attempts >= MAX_ATTEMPTS) {
        entry.lockedUntil = now + LOCKOUT_DURATION_MS;
        entry.lastSeen = now;
        return {
            allowed: false,
            retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        };
    }

    entry.attempts++;
    entry.lastSeen = now;
    return { allowed: true };
}

function resetRateLimit(userId: string): void {
    rateLimitMap.delete(userId);
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { session, error } = await requireAuth(request);
        if (error) return error;

        // Rate limit check
        const rateCheck = checkRateLimit(session.user.id);
        if (!rateCheck.allowed) {
            logger.warn('Password change rate limited', {
                userId: session.user.id,
                retryAfterSeconds: rateCheck.retryAfterSeconds,
            });
            return errorResponse(
                `Too many attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
                429
            );
        }

        // Parse form data
        const formData = await request.formData();
        const currentPassword = formData.get('currentPassword') as string;
        const newPassword = formData.get('newPassword') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            return errorResponse('All fields are required', 400);
        }

        if (newPassword !== confirmPassword) {
            return errorResponse('New passwords do not match', 400);
        }

        if (newPassword.length < 6) {
            return errorResponse(
                'New password must be at least 6 characters',
                400
            );
        }
        if (newPassword.length > MAX_PASSWORD_LENGTH) {
            return errorResponse(
                `New password must be at most ${MAX_PASSWORD_LENGTH} characters`,
                400
            );
        }

        // Verify current password
        const [account] = await db
            .select()
            .from(accounts)
            .where(
                and(
                    eq(accounts.userId, session.user.id),
                    eq(accounts.providerId, 'email')
                )
            )
            .limit(1);

        if (!account || !account.password) {
            return errorResponse('Account not found', 404);
        }

        const isCurrentPasswordValid = await bcrypt.compare(
            currentPassword,
            account.password
        );
        if (!isCurrentPasswordValid) {
            logger.warn('Failed password change attempt', {
                userId: session.user.id,
            });
            return errorResponse('Current password is incorrect', 400);
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db
            .update(accounts)
            .set({
                password: hashedNewPassword,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(accounts.userId, session.user.id),
                    eq(accounts.providerId, 'email')
                )
            );

        resetRateLimit(session.user.id);

        return jsonResponse({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (error) {
        logger.error('Failed to change password', error, {
            endpoint: '/api/auth/change-password',
            errorId: ERROR_IDS.AUTH_PASSWORD_CHANGE_FAILED,
        });
        return errorResponse('Failed to change password', 500);
    }
};
