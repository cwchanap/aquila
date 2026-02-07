import type { APIRoute } from 'astro';
import { getTranslations } from '@aquila/dialogue';
import { CharacterSetupRepository } from '@/lib/drizzle/repositories.js';
import { StoryId, isValidStoryId } from '@/lib/story-types.js';
import { logger } from '@/lib/logger.js';
import {
    requireAuth,
    parseBody,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { CharacterSetupSchema } from '@/lib/schemas.js';
import {
    resolveValidationMessage,
    validateCharacterName,
    type ValidationTranslations,
} from '@/lib/validation.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { session, error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { data, error: validationError } = await parseBody(
            request,
            CharacterSetupSchema
        );
        if (validationError) return validationError;

        const translations = getTranslations(data.locale);
        const validationTranslations: ValidationTranslations = {
            email: translations.email,
            username: translations.username,
            characterName: translations.characterName,
        };

        // Additional character name validation with localized messages
        const nameValidation = validateCharacterName(data.characterName);
        if (!nameValidation.valid) {
            return errorResponse(
                resolveValidationMessage(
                    validationTranslations,
                    nameValidation.errorKey
                ),
                400
            );
        }

        if (!isValidStoryId(data.storyId)) {
            return errorResponse(translations.characters.invalidStoryId, 400);
        }

        const sanitizedName = nameValidation.sanitizedName;

        // Check if character setup already exists for this user and story
        const characterSetupRepo = new CharacterSetupRepository();
        const existingSetup = await characterSetupRepo.findByUserAndStory(
            session.user.id,
            data.storyId as StoryId
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
                storyId: data.storyId as StoryId,
            });
            return jsonResponse(setup, 201);
        }
    } catch (error) {
        logger.error('Failed to save character setup', error, {
            endpoint: '/api/character-setup',
            errorId: ERROR_IDS.CHAR_SETUP_FAILED,
        });
        return errorResponse('Failed to save character setup', 500);
    }
};

export const GET: APIRoute = async ({ request, url }) => {
    try {
        const { session, error } = await requireAuth(request);
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
        logger.error('Failed to fetch character setup', error, {
            endpoint: '/api/character-setup',
            errorId: ERROR_IDS.DB_QUERY_FAILED,
        });
        return errorResponse('Failed to fetch character setup', 500);
    }
};
