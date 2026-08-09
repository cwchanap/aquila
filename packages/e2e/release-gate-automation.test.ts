import { describe, expect, test } from 'bun:test';
import { resolveAutomationBypassHeaders } from './release-gate-automation';

describe('resolveAutomationBypassHeaders', () => {
    test('sends the Vercel automation bypass and persists it for page resources', () => {
        expect(
            resolveAutomationBypassHeaders(
                'gate-secret',
                'https://preview.example.com/en/reader',
                'https://preview.example.com'
            )
        ).toEqual({
            'x-vercel-protection-bypass': 'gate-secret',
            'x-vercel-set-bypass-cookie': 'true',
        });
    });

    test('does not leak the bypass secret to cross-origin asset requests', () => {
        expect(
            resolveAutomationBypassHeaders(
                'gate-secret',
                'https://assets.example.com/runtime-manifest.json',
                'https://preview.example.com'
            )
        ).toBeUndefined();
    });

    test('leaves public deployments unauthenticated when no secret is configured', () => {
        expect(
            resolveAutomationBypassHeaders(
                undefined,
                'https://preview.example.com/en/reader',
                'https://preview.example.com'
            )
        ).toBeUndefined();
        expect(
            resolveAutomationBypassHeaders(
                '',
                'https://preview.example.com/en/reader',
                'https://preview.example.com'
            )
        ).toBeUndefined();
    });
});
