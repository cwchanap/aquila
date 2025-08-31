import { betterAuth } from "better-auth"
import { db } from "./db.js"

export const auth = betterAuth({
  database: {
    provider: "kysely",
    kysely: db,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  trustedOrigins: ["http://localhost:5090"],
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-for-development-only",
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
