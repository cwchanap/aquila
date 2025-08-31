import type { APIRoute } from 'astro'
import { CharacterSetupRepository } from '@/lib/repositories.js'
import { StoryId, isValidStoryId } from '@/lib/story-types.js'
import { auth } from '@/lib/auth.js'

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { characterName, storyId } = await request.json()

    if (!characterName || typeof characterName !== 'string' || characterName.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Character name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!storyId || !isValidStoryId(storyId)) {
      return new Response(JSON.stringify({ error: 'Valid story ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if character setup already exists for this user and story
    const existingSetup = await CharacterSetupRepository.findByUserAndStory(session.user.id, storyId as StoryId)
    
    if (existingSetup) {
      // Update existing setup
      const updatedSetup = await CharacterSetupRepository.update(existingSetup.id, {
        characterName: characterName.trim()
      })
      return new Response(JSON.stringify(updatedSetup), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      // Create new setup
      const setup = await CharacterSetupRepository.create({
        userId: session.user.id,
        characterName: characterName.trim(),
        storyId: storyId as StoryId
      })
      return new Response(JSON.stringify(setup), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Character setup error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const storyId = url.searchParams.get('storyId')
    
    if (storyId && isValidStoryId(storyId)) {
      // Get setup for specific story
      const setup = await CharacterSetupRepository.findByUserAndStory(session.user.id, storyId as StoryId)
      return new Response(JSON.stringify(setup), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      // Get all setups for user
      const setups = await CharacterSetupRepository.findByUser(session.user.id)
      return new Response(JSON.stringify(setups), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Get character setup error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
