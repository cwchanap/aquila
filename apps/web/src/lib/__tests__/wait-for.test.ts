// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/svelte';

describe('waitFor under fake timers', () => {
    it('re-checks without a DOM mutation once jest is aliased', async () => {
        // No DOM anywhere — before the jest alias this waitFor could only
        // re-run on a container MutationObserver callback, so it starved
        // until the test timed out.
        let flag = false;
        void Promise.resolve().then(() => {
            flag = true;
        });
        await waitFor(() => expect(flag).toBe(true));
    });
});
