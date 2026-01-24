import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { auth } from '../../../lib/auth.js';
import { ALL } from '../auth/[...all]';

let handler: ReturnType<typeof vi.spyOn>;

describe('Auth catch-all API', () => {
    beforeAll(() => {
        handler = vi.spyOn(auth, 'handler');
    });

    beforeEach(() => {
        handler.mockReset();
    });

    it('delegates to auth.handler', async () => {
        const request = new Request('http://localhost/api/auth');
        handler.mockResolvedValue(new Response('ok', { status: 200 }));

        const response = await ALL({ request } as any);

        expect(handler).toHaveBeenCalledWith(request);
        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('ok');
    });
});
