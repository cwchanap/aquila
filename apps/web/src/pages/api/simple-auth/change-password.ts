import type { APIRoute } from 'astro';
import { SimpleAuthService } from '../../../lib/simple-auth.js';
import { db } from '../../../lib/drizzle/db.js';
import { accounts } from '../../../lib/drizzle/schema.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logger } from '../../../lib/logger.js';
import { jsonResponse, errorResponse } from '../../../lib/api-utils.js';
import { ERROR_IDS } from '../../../constants/errorIds.js';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Get session
        const sessionId = cookies.get('session')?.value;
        if (!sessionId) {
            return errorResponse('Not authenticated', 401);
        }

        const session = await SimpleAuthService.getSession(sessionId);
        if (!session) {
            return errorResponse('Invalid session', 401);
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

        return jsonResponse({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (error) {
        logger.error('Failed to change password', error, {
            endpoint: '/api/simple-auth/change-password',
            errorId: ERROR_IDS.AUTH_PASSWORD_HASH_FAILED,
        });
        return errorResponse('Failed to change password', 500);
    }
};
