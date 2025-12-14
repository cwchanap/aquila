import type { User } from '../drizzle/schema';
import { UserRepository } from '../drizzle/repositories';
import { getSupabaseAuthClient } from '../auth';
import { randomUUID } from 'crypto';

export interface AuthContext {
    supabaseUserId: string;
    email: string;
    appUser: User;
}

export async function requireSupabaseUser(
    request: Request
): Promise<AuthContext | Response> {
    const authHeader =
        request.headers.get('authorization') ||
        request.headers.get('Authorization');

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const token = authHeader.slice('bearer '.length).trim();
    if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const supabaseUser = data.user;
    const supabaseUserId = supabaseUser.id;
    const email = supabaseUser.email ?? '';

    if (!email) {
        return new Response(JSON.stringify({ error: 'Email is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const repository = new UserRepository();
    let appUser: User;
    try {
        appUser = await repository.findOrCreateBySupabaseUserId(
            supabaseUserId,
            {
                email,
                name:
                    (
                        supabaseUser.user_metadata as Record<
                            string,
                            unknown
                        > | null
                    )?.full_name?.toString() ?? null,
                username: null,
                image:
                    (
                        supabaseUser.user_metadata as Record<
                            string,
                            unknown
                        > | null
                    )?.avatar_url?.toString() ?? null,
            }
        );
    } catch (error) {
        const correlationId = randomUUID();
        const safeMessage =
            error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as { code?: string } | null)?.code;

        console.error(
            JSON.stringify({
                level: 'error',
                msg: 'Failed to find or create user from Supabase identity',
                correlationId,
                supabaseUserId,
                email,
                error: safeMessage,
                code: errorCode,
            })
        );

        const isEmailConflict =
            safeMessage.includes(
                'already linked to a different Supabase user'
            ) || errorCode === '23505';

        if (isEmailConflict) {
            return new Response(
                JSON.stringify({
                    error: 'This email is already linked to another account.',
                    correlationId,
                }),
                {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        return new Response(
            JSON.stringify({
                error: 'Unable to complete authentication.',
                correlationId,
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    return {
        supabaseUserId,
        email,
        appUser,
    };
}
