import type { APIRoute } from 'astro';
import { getTranslations, type Locale } from '@aquila/dialogue';
import { CharacterSetupRepository } from '@/lib/drizzle/repositories.js';
import { StoryId, isValidStoryId } from '@/lib/story-types.js';
import { logger } from '@/lib/logger.js';
import {
    requireSession,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import {
    resolveValidationMessage,
    validateCharacterName,
    type ValidationTranslations,
} from '@/lib/validation.js';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { session, error } = await requireSession(request);
        if (error) return error;

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
            return errorResponse(
                resolveValidationMessage(
                    validationTranslations,
                    nameValidation.errorKey
                ),
                400
            );
        }

        if (!storyId || !isValidStoryId(storyId)) {
            return errorResponse(translations.characters.invalidStoryId, 400);
        }

        const sanitizedName = nameValidation.sanitizedName;

        // Check if character setup already exists for this user and story
        const characterSetupRepo = new CharacterSetupRepository();
        const existingSetup = await characterSetupRepo.findByUserAndStory(
            session.user.id,
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
            return jsonResponse(updatedSetup);
        } else {
            // Create new setup
            const setup = await characterSetupRepo.create({
                userId: session.user.id,
                characterName: sanitizedName,
                storyId: storyId as StoryId,
            });
            return jsonResponse(setup, 201);
        }
    } catch (error) {
        logger.error('Character setup error', error, {
            endpoint: '/api/character-setup',
        });
        return errorResponse('Internal server error', 500);
    }
};

export const GET: APIRoute = async ({ request, url }) => {
    try {
        const { session, error } = await requireSession(request);
        if (error) return error;

        const storyId = url.searchParams.get('storyId');
        const characterSetupRepo = new CharacterSetupRepository();

        if (storyId && isValidStoryId(storyId)) {
            // Get setup for specific story
            const setup = await characterSetupRepo.findByUserAndStory(
                session.user.id,
                storyId as StoryId
            );
            return jsonResponse(setup);
        } else {
            // Get all setups for user
            const setups = await characterSetupRepo.findByUser(session.user.id);
            return jsonResponse(setups);
        }
    } catch (error) {
        logger.error('Get character setup error', error, {
            endpoint: '/api/character-setup',
        });
        return errorResponse('Internal server error', 500);
    }
};
