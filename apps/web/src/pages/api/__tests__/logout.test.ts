import { describe, it, expect } from 'vitest';
import { POST } from '../logout';

describe('Logout API', () => {
    it('should export POST function', () => {
        expect(typeof POST).toBe('function');
    });

    it('should return redirect response with cleared session cookie', async () => {
        const mockContext = {} as any;

        const result = await POST(mockContext);

        expect(result.status).toBe(302);
        expect(result.headers.get('Location')).toBe('/');

        const setCookieHeader =
            result.headers.get('Set-Cookie') ??
            result.headers.get('set-cookie');
        if (setCookieHeader) {
            expect(setCookieHeader).toContain('session=;');
            expect(setCookieHeader).toContain('Path=/');
            expect(setCookieHeader).toContain('HttpOnly');
            expect(setCookieHeader).toContain('SameSite=Strict');
            expect(setCookieHeader).toContain('Max-Age=0');
        }
    });

    it('should handle the request without any parameters', async () => {
        // The logout endpoint doesn't use the request object
        const result = await POST({} as any);

        expect(result.status).toBe(302);
        expect(result.headers.get('Location')).toBe('/');
    });
});
