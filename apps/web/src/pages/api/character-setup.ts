import type { APIRoute } from 'astro';
import { CharacterSetupRepository } from '@/lib/drizzle/repositories.js';
import { StoryId, isValidStoryId } from '@/lib/story-types.js';
import { requireSupabaseUser } from '@/lib/auth/server';
import { isValidCharacterName } from '@/lib/validation.js';

export const POST: APIRoute = async ({ request }) => {
    try {
        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }
        const { appUser } = authResult;

        const { characterName, storyId } = await request.json();

        if (!isValidCharacterName(characterName)) {
            return new Response(
                JSON.stringify({ error: 'Character name is required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        if (!storyId || !isValidStoryId(storyId)) {
            return new Response(
                JSON.stringify({ error: 'Valid story ID is required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Check if character setup already exists for this user and story
        const characterSetupRepo = new CharacterSetupRepository();
        const existingSetup = await characterSetupRepo.findByUserAndStory(
            appUser.id,
            storyId as StoryId
        );

        if (existingSetup) {
            // Update existing setup
            const updatedSetup = await characterSetupRepo.update(
                existingSetup.id,
                {
                    characterName: characterName.trim(),
                }
            );
            return new Response(JSON.stringify(updatedSetup), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            // Create new setup
            const setup = await characterSetupRepo.create({
                userId: appUser.id,
                characterName: characterName.trim(),
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
        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }
        const { appUser } = authResult;

        const storyId = url.searchParams.get('storyId');
        const characterSetupRepo = new CharacterSetupRepository();

        if (storyId && isValidStoryId(storyId)) {
            // Get setup for specific story
            const existingSetup = await characterSetupRepo.findByUserAndStory(
                appUser.id,
                storyId as StoryId
            );
            return new Response(JSON.stringify(existingSetup), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            // Get all setups for user
            const setups = await characterSetupRepo.findByUser(appUser.id);
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
