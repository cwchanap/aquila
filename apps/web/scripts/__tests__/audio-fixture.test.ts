/**
 * Tests for the shared audio-fixture CLI dispatcher.
 *
 * `runAudioFixtureCli` is the only helper not exercised by the in-process
 * build/verify suites (the per-script `if (import.meta.main)` guards that
 * call it run as subprocesses, which don't accrue coverage). Cover both
 * branches directly here.
 */
import { describe, expect, it, vi } from 'vitest';
import { runAudioFixtureCli } from '../audio-fixture';

describe('runAudioFixtureCli', () => {
    it('runs build when --verify is absent from argv', async () => {
        const build = vi.fn(async () => {});
        const verify = vi.fn(async () => {});
        // process.argv in the vitest runner never includes --verify.
        await runAudioFixtureCli(build, verify);
        expect(build).toHaveBeenCalledTimes(1);
        expect(verify).not.toHaveBeenCalled();
    });

    it('runs verify when --verify is present in argv', async () => {
        const build = vi.fn(async () => {});
        const verify = vi.fn(async () => {});
        const originalArgv = process.argv;
        process.argv = [...originalArgv, '--verify'];
        try {
            await runAudioFixtureCli(build, verify);
            expect(verify).toHaveBeenCalledTimes(1);
            expect(build).not.toHaveBeenCalled();
        } finally {
            process.argv = originalArgv;
        }
    });
});
