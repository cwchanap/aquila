/**
 * Tests the moduleValue.default branch (line 44) in utils.ts#t().
 * This branch fires when translations[locale] has a `.default` sub-key,
 * which happens when a JSON module is imported as a module namespace object
 * (CommonJS-compatible interop) rather than as a plain JSON value.
 *
 * A separate test file is required because the main utils.test.ts uses
 * vi.mock for individual JSON paths, and each test file gets its own
 * isolated module registry in Vitest.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@aquila/stories/translations', () => ({
    translations: {
        en: {
            default: {
                greeting: 'Hello via default',
            },
        },
        zh: {
            default: {
                greeting: '你好 via default',
            },
        },
    },
}));

describe('t() — moduleValue.default interop branch (line 44)', () => {
    it('resolves translation through moduleValue.default when translations have a default property', async () => {
        const { t } = await import('../utils');
        expect(t('en', 'greeting')).toBe('Hello via default');
    });

    it('resolves zh translation through moduleValue.default', async () => {
        const { t } = await import('../utils');
        expect(t('zh', 'greeting')).toBe('你好 via default');
    });
});
