/**
 * Custom error classes for domain-specific error handling.
 *
 * These errors allow proper error handling at different layers:
 * - Service layer throws specific errors
 * - API layer catches and maps to appropriate HTTP responses
 * - Logging layer includes error IDs for tracking
 */

import { ERROR_IDS, type ErrorId } from '../constants/errorIds.js';

/**
 * Base class for all application errors.
 * Includes error ID for Sentry tracking and correlation.
 */
export class AppError extends Error {
    public readonly errorId: ErrorId;
    public readonly statusCode: number;

    constructor(message: string, errorId: ErrorId, statusCode: number = 500) {
        super(message);
        this.name = this.constructor.name;
        this.errorId = errorId;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Thrown when a user tries to sign up with an email that already exists.
 */
export class UserAlreadyExistsError extends AppError {
    constructor(message: string = 'User with this email already exists') {
        super(message, ERROR_IDS.AUTH_USER_ALREADY_EXISTS, 409);
    }
}

/**
 * Thrown when session creation fails due to database errors.
 */
export class SessionCreationError extends AppError {
    constructor(message: string = 'Failed to create user session') {
        super(message, ERROR_IDS.AUTH_SESSION_CREATE_FAILED, 500);
    }
}

/**
 * Thrown when session deletion fails due to database errors.
 */
export class SessionDeletionError extends AppError {
    constructor(message: string = 'Failed to delete user session') {
        super(message, ERROR_IDS.AUTH_SESSION_DELETE_FAILED, 500);
    }
}

/**
 * Thrown when authentication credentials are invalid.
 * Used for both "user not found" and "wrong password" to prevent timing attacks.
 */
export class InvalidCredentialsError extends AppError {
    constructor(message: string = 'Invalid email or password') {
        super(message, ERROR_IDS.AUTH_INVALID_CREDENTIALS, 401);
    }
}

/**
 * Thrown when password hashing fails.
 */
export class PasswordHashError extends AppError {
    constructor(message: string = 'Failed to hash password') {
        super(message, ERROR_IDS.AUTH_PASSWORD_HASH_FAILED, 500);
    }
}

/**
 * Thrown when a database operation fails.
 */
export class DatabaseError extends AppError {
    constructor(message: string, errorId: ErrorId = ERROR_IDS.DB_QUERY_FAILED) {
        super(message, errorId, 500);
    }
}
