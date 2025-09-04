import { betterAuth } from "better-auth"
import { db } from "./db.js"

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5090",
  database: {
    db,
    type: "sqlite",
    casing: "camel",
    debugLogs: true,
  },
  // Map core models to our pluralized table names
  user: {
    modelName: "users",
  },
  session: {
    modelName: "sessions",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  account: {
    modelName: "accounts",
  },
  verification: {
    modelName: "verificationTokens",
    fields: {
      value: "token",
      expiresAt: "expires",
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  trustedOrigins: ["http://localhost:5090"],
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-for-development-only",
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
