import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  // Clear the user cookie
  return new Response(null, {
    status: 302,
    headers: {
      "Location": "/",
      "Set-Cookie": "user=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
    }
  });
};
