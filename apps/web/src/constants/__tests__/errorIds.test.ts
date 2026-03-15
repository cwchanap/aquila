import { describe, it, expect } from 'vitest';
import { ERROR_IDS, type ErrorId } from '../errorIds';

describe('ERROR_IDS', () => {
    describe('Structure', () => {
        it('should be a non-empty object', () => {
            expect(ERROR_IDS).toBeDefined();
            expect(typeof ERROR_IDS).toBe('object');
            expect(Object.keys(ERROR_IDS).length).toBeGreaterThan(0);
        });

        it('all values should be strings', () => {
            for (const value of Object.values(ERROR_IDS)) {
                expect(typeof value).toBe('string');
            }
        });

        it('all values should be unique', () => {
            const values = Object.values(ERROR_IDS);
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
        });
    });

    describe('Authentication errors (AUTH_001-009)', () => {
        it('should define AUTH_SIGNUP_FAILED as AUTH_001', () => {
            expect(ERROR_IDS.AUTH_SIGNUP_FAILED).toBe('AUTH_001');
        });

        it('should define AUTH_SIGNIN_FAILED as AUTH_002', () => {
            expect(ERROR_IDS.AUTH_SIGNIN_FAILED).toBe('AUTH_002');
        });

        it('should define AUTH_SESSION_CREATE_FAILED as AUTH_003', () => {
            expect(ERROR_IDS.AUTH_SESSION_CREATE_FAILED).toBe('AUTH_003');
        });

        it('should define AUTH_SESSION_DELETE_FAILED as AUTH_004', () => {
            expect(ERROR_IDS.AUTH_SESSION_DELETE_FAILED).toBe('AUTH_004');
        });

        it('should define AUTH_SESSION_GET_FAILED as AUTH_005', () => {
            expect(ERROR_IDS.AUTH_SESSION_GET_FAILED).toBe('AUTH_005');
        });

        it('should define AUTH_USER_ALREADY_EXISTS as AUTH_006', () => {
            expect(ERROR_IDS.AUTH_USER_ALREADY_EXISTS).toBe('AUTH_006');
        });

        it('should define AUTH_INVALID_CREDENTIALS as AUTH_007', () => {
            expect(ERROR_IDS.AUTH_INVALID_CREDENTIALS).toBe('AUTH_007');
        });

        it('should define AUTH_PASSWORD_HASH_FAILED as AUTH_008', () => {
            expect(ERROR_IDS.AUTH_PASSWORD_HASH_FAILED).toBe('AUTH_008');
        });

        it('should define AUTH_PASSWORD_CHANGE_FAILED as AUTH_009', () => {
            expect(ERROR_IDS.AUTH_PASSWORD_CHANGE_FAILED).toBe('AUTH_009');
        });
    });

    describe('Database errors (DB_001-007)', () => {
        it('should define DB_CONNECTION_FAILED as DB_001', () => {
            expect(ERROR_IDS.DB_CONNECTION_FAILED).toBe('DB_001');
        });

        it('should define DB_TRANSACTION_FAILED as DB_002', () => {
            expect(ERROR_IDS.DB_TRANSACTION_FAILED).toBe('DB_002');
        });

        it('should define DB_QUERY_FAILED as DB_003', () => {
            expect(ERROR_IDS.DB_QUERY_FAILED).toBe('DB_003');
        });

        it('should define DB_INSERT_FAILED as DB_004', () => {
            expect(ERROR_IDS.DB_INSERT_FAILED).toBe('DB_004');
        });

        it('should define DB_UPDATE_FAILED as DB_005', () => {
            expect(ERROR_IDS.DB_UPDATE_FAILED).toBe('DB_005');
        });

        it('should define DB_DELETE_FAILED as DB_006', () => {
            expect(ERROR_IDS.DB_DELETE_FAILED).toBe('DB_006');
        });

        it('should define DB_CONSTRAINT_VIOLATION as DB_007', () => {
            expect(ERROR_IDS.DB_CONSTRAINT_VIOLATION).toBe('DB_007');
        });
    });

    describe('Validation errors (VAL_001-009)', () => {
        it('should define VALIDATION_EMAIL_INVALID as VAL_001', () => {
            expect(ERROR_IDS.VALIDATION_EMAIL_INVALID).toBe('VAL_001');
        });

        it('should define VALIDATION_EMAIL_REQUIRED as VAL_002', () => {
            expect(ERROR_IDS.VALIDATION_EMAIL_REQUIRED).toBe('VAL_002');
        });

        it('should define VALIDATION_EMAIL_TOO_LONG as VAL_003', () => {
            expect(ERROR_IDS.VALIDATION_EMAIL_TOO_LONG).toBe('VAL_003');
        });

        it('should define VALIDATION_USERNAME_INVALID as VAL_004', () => {
            expect(ERROR_IDS.VALIDATION_USERNAME_INVALID).toBe('VAL_004');
        });

        it('should define VALIDATION_USERNAME_TOO_SHORT as VAL_005', () => {
            expect(ERROR_IDS.VALIDATION_USERNAME_TOO_SHORT).toBe('VAL_005');
        });

        it('should define VALIDATION_USERNAME_TOO_LONG as VAL_006', () => {
            expect(ERROR_IDS.VALIDATION_USERNAME_TOO_LONG).toBe('VAL_006');
        });

        it('should define VALIDATION_CHARACTER_NAME_INVALID as VAL_007', () => {
            expect(ERROR_IDS.VALIDATION_CHARACTER_NAME_INVALID).toBe('VAL_007');
        });

        it('should define VALIDATION_CHARACTER_NAME_TOO_SHORT as VAL_008', () => {
            expect(ERROR_IDS.VALIDATION_CHARACTER_NAME_TOO_SHORT).toBe(
                'VAL_008'
            );
        });

        it('should define VALIDATION_CHARACTER_NAME_TOO_LONG as VAL_009', () => {
            expect(ERROR_IDS.VALIDATION_CHARACTER_NAME_TOO_LONG).toBe(
                'VAL_009'
            );
        });
    });

    describe('API errors (API_001-006)', () => {
        it('should define API_INVALID_REQUEST as API_001', () => {
            expect(ERROR_IDS.API_INVALID_REQUEST).toBe('API_001');
        });

        it('should define API_INVALID_JSON as API_002', () => {
            expect(ERROR_IDS.API_INVALID_JSON).toBe('API_002');
        });

        it('should define API_MISSING_PARAMETER as API_003', () => {
            expect(ERROR_IDS.API_MISSING_PARAMETER).toBe('API_003');
        });

        it('should define API_INVALID_PARAMETER as API_004', () => {
            expect(ERROR_IDS.API_INVALID_PARAMETER).toBe('API_004');
        });

        it('should define API_RESOURCE_NOT_FOUND as API_005', () => {
            expect(ERROR_IDS.API_RESOURCE_NOT_FOUND).toBe('API_005');
        });

        it('should define API_INTERNAL_ERROR as API_006', () => {
            expect(ERROR_IDS.API_INTERNAL_ERROR).toBe('API_006');
        });
    });

    describe('Repository errors (REPO_001-008)', () => {
        it('should define REPO_USER_NOT_FOUND as REPO_001', () => {
            expect(ERROR_IDS.REPO_USER_NOT_FOUND).toBe('REPO_001');
        });

        it('should define REPO_USER_CREATE_FAILED as REPO_002', () => {
            expect(ERROR_IDS.REPO_USER_CREATE_FAILED).toBe('REPO_002');
        });

        it('should define REPO_USER_UPDATE_FAILED as REPO_003', () => {
            expect(ERROR_IDS.REPO_USER_UPDATE_FAILED).toBe('REPO_003');
        });

        it('should define REPO_USER_DELETE_FAILED as REPO_004', () => {
            expect(ERROR_IDS.REPO_USER_DELETE_FAILED).toBe('REPO_004');
        });

        it('should define REPO_STORY_NOT_FOUND as REPO_005', () => {
            expect(ERROR_IDS.REPO_STORY_NOT_FOUND).toBe('REPO_005');
        });

        it('should define REPO_CHAPTER_NOT_FOUND as REPO_006', () => {
            expect(ERROR_IDS.REPO_CHAPTER_NOT_FOUND).toBe('REPO_006');
        });

        it('should define REPO_SCENE_NOT_FOUND as REPO_007', () => {
            expect(ERROR_IDS.REPO_SCENE_NOT_FOUND).toBe('REPO_007');
        });

        it('should define REPO_USER_FETCH_FAILED as REPO_008', () => {
            expect(ERROR_IDS.REPO_USER_FETCH_FAILED).toBe('REPO_008');
        });
    });

    describe('Character setup errors (CHAR_001-002)', () => {
        it('should define CHAR_SETUP_FAILED as CHAR_001', () => {
            expect(ERROR_IDS.CHAR_SETUP_FAILED).toBe('CHAR_001');
        });

        it('should define CHAR_VALIDATION_FAILED as CHAR_002', () => {
            expect(ERROR_IDS.CHAR_VALIDATION_FAILED).toBe('CHAR_002');
        });
    });

    describe('ErrorId type', () => {
        it('should accept valid error IDs at compile time', () => {
            const id: ErrorId = ERROR_IDS.AUTH_SIGNUP_FAILED;
            expect(id).toBe('AUTH_001');
        });

        it('should be assignable from any ERROR_IDS value', () => {
            const ids: ErrorId[] = Object.values(ERROR_IDS);
            expect(ids.length).toBeGreaterThan(0);
        });
    });
});
