// Database schema types for Kysely

export interface Database {
  users: UserTable
}

export interface UserTable {
  id: string
  email: string
  username: string
  created_at: string
  updated_at: string
}
