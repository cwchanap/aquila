import { createAuthClient } from "better-auth/client"

export const authClient = createAuthClient({
  baseURL: "http://localhost:5090", // Replace with your domain in production
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient
