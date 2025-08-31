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
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
      },
    },
  },
  trustedOrigins: ["http://localhost:5090"],
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-here",
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
