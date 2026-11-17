// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/svelte';
import { useFakeTimerWaitFor } from '../test-setup';

describe('waitFor under fake timers', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('re-checks without a DOM mutation once jest is aliased', async () => {
        useFakeTimerWaitFor();
        // No DOM anywhere — without the opt-in jest alias this waitFor could
        // only re-run on a container MutationObserver callback, so it starved
        // until the test timed out.
        let flag = false;
        void Promise.resolve().then(() => {
            flag = true;
        });
        await waitFor(() => expect(flag).toBe(true));
    });
});
