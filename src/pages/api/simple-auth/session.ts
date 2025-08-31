import type { APIRoute } from 'astro'
import { SimpleAuthService } from '../../../lib/simple-auth.js'

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const sessionId = cookies.get('session')?.value

    if (!sessionId) {
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = await SimpleAuthService.getSession(sessionId)
    
    return new Response(JSON.stringify({ user: session?.user || null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Session error:', error)
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const POST: APIRoute = async ({ cookies }) => {
  try {
    const sessionId = cookies.get('session')?.value

    if (sessionId) {
      await SimpleAuthService.deleteSession(sessionId)
    }

    // Clear session cookie
    cookies.delete('session', { path: '/' })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Logout error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
