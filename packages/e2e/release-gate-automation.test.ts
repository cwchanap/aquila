import { describe, expect, test } from 'bun:test';
import { resolveAutomationBypassHeaders } from './release-gate-automation';

describe('resolveAutomationBypassHeaders', () => {
    test('sends the Vercel automation bypass and persists it for page resources', () => {
        expect(resolveAutomationBypassHeaders('gate-secret')).toEqual({
            'x-vercel-protection-bypass': 'gate-secret',
            'x-vercel-set-bypass-cookie': 'true',
        });
    });

    test('leaves public deployments unauthenticated when no secret is configured', () => {
        expect(resolveAutomationBypassHeaders(undefined)).toBeUndefined();
        expect(resolveAutomationBypassHeaders('')).toBeUndefined();
    });
});
