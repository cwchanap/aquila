import type { APIRoute } from 'astro'
import { SimpleAuthService } from '../../../lib/simple-auth.js'
import bcrypt from 'bcryptjs'
import { db } from '../../../lib/db.js'

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Get session
    const sessionId = cookies.get('session')?.value
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = await SimpleAuthService.getSession(sessionId)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse form data
    const formData = await request.formData()
    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return new Response(JSON.stringify({ error: 'All fields are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (newPassword !== confirmPassword) {
      return new Response(JSON.stringify({ error: 'New passwords do not match' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'New password must be at least 6 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify current password
    const account = await db
      .selectFrom('accounts')
      .selectAll()
      .where('userId', '=', session.user.id)
      .where('providerId', '=', 'email')
      .executeTakeFirst()

    if (!account || !account.password) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, account.password)
    if (!isCurrentPasswordValid) {
      return new Response(JSON.stringify({ error: 'Current password is incorrect' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await db
      .updateTable('accounts')
      .set({
        password: hashedNewPassword,
        updatedAt: new Date().toISOString()
      })
      .where('userId', '=', session.user.id)
      .where('providerId', '=', 'email')
      .execute()

    return new Response(JSON.stringify({ success: true, message: 'Password updated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Change password error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}