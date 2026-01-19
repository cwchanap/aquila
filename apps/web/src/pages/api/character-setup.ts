import type { APIRoute } from 'astro';
import { getTranslations, type Locale } from '@aquila/dialogue';
import { CharacterSetupRepository } from '@/lib/drizzle/repositories.js';
import { StoryId, isValidStoryId } from '@/lib/story-types.js';
import { SimpleAuthService } from '@/lib/simple-auth.js';
import {
    resolveValidationMessage,
    validateCharacterName,
    type ValidationTranslations,
} from '@/lib/validation.js';

async function validateSession(
    request: Request
): Promise<{ userId: string } | Response> {
    // Get session from cookie
    const cookieHeader = request.headers.get('cookie') || '';
    const sessionId = cookieHeader
        .split(';')
        .find(c => c.trim().startsWith('session='))
        ?.split('=')[1];

    if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const session = await SimpleAuthService.getSession(sessionId);
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return { userId: session.user.id };
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const sessionValidation = await validateSession(request);
        if (sessionValidation instanceof Response) {
            return sessionValidation;
        }
        const { userId } = sessionValidation;

        const {
            characterName,
            storyId,
            locale: rawLocale,
        } = await request.json();
        const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
        const translations = getTranslations(locale);
        const validationTranslations: ValidationTranslations = {
            email: translations.email,
            username: translations.username,
            characterName: translations.characterName,
        };

        const nameValidation = validateCharacterName(characterName);
        if (!nameValidation.valid) {
            return new Response(
                JSON.stringify({
                    error: resolveValidationMessage(
                        validationTranslations,
                        nameValidation.errorKey
                    ),
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        if (!storyId || !isValidStoryId(storyId)) {
            return new Response(
                JSON.stringify({
                    error: translations.characters.invalidStoryId,
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const sanitizedName = nameValidation.sanitizedName;

        // Check if character setup already exists for this user and story
        const characterSetupRepo = new CharacterSetupRepository();
        const existingSetup = await characterSetupRepo.findByUserAndStory(
            userId,
            storyId as StoryId
        );

        if (existingSetup) {
            // Update existing setup
            const updatedSetup = await characterSetupRepo.update(
                existingSetup.id,
                {
                    characterName: sanitizedName,
                }
            );
            return new Response(JSON.stringify(updatedSetup), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            // Create new setup
            const setup = await characterSetupRepo.create({
                userId: userId,
                characterName: sanitizedName,
                storyId: storyId as StoryId,
            });
            return new Response(JSON.stringify(setup), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        console.error('Character setup error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

export const GET: APIRoute = async ({ request, url }) => {
    try {
        const sessionValidation = await validateSession(request);
        if (sessionValidation instanceof Response) {
            return sessionValidation;
        }
        const { userId } = sessionValidation;

        const storyId = url.searchParams.get('storyId');
        const characterSetupRepo = new CharacterSetupRepository();

        if (storyId && isValidStoryId(storyId)) {
            // Get setup for specific story
            const setup = await characterSetupRepo.findByUserAndStory(
                userId,
                storyId as StoryId
            );
            return new Response(JSON.stringify(setup), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            // Get all setups for user
            const setups = await characterSetupRepo.findByUser(userId);
            return new Response(JSON.stringify(setups), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        console.error('Get character setup error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
