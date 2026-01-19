import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/auth.js', () => ({
    auth: {
        handler: vi.fn(),
    },
}));

import { auth } from '../../../lib/auth.js';
import { ALL } from '../auth/[...all]';

const handler = vi.mocked(auth.handler) as unknown as ReturnType<typeof vi.fn>;

describe('Auth catch-all API', () => {
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
