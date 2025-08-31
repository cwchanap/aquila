import type { APIRoute } from 'astro'
import { SimpleAuthService } from '../../../lib/simple-auth.js'

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const user = await SimpleAuthService.signUp(email, password, name)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Failed to create user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create session
    const sessionId = await SimpleAuthService.createSession(user)
    
    // Set session cookie
    cookies.set('session', sessionId, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Signup error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
