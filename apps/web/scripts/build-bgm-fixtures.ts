import { resolve } from 'node:path';
import {
    buildAudioFixtures,
    runAudioFixtureCli,
    synthPcm16Wav,
    verifyAudioFixtures,
} from './audio-fixture';

const outputRoot = resolve(process.cwd(), 'public/assets/vn/audio/bgm');

function fixtures(): Record<string, Buffer> {
    return {
        'dawn-apartment.wav': synthPcm16Wav(
            2_000,
            t =>
                0.18 * Math.sin(2 * Math.PI * 220 * t) +
                0.08 * Math.sin(2 * Math.PI * 330 * t)
        ),
        'tension-pulse.wav': synthPcm16Wav(
            2_000,
            t =>
                0.2 * Math.sin(2 * Math.PI * 110 * t) +
                0.1 * Math.sin(2 * Math.PI * 165 * t)
        ),
    };
}

export async function buildBgmFixtures(): Promise<void> {
    await buildAudioFixtures(outputRoot, fixtures());
}

export async function verifyBgmFixtures(): Promise<void> {
    await verifyAudioFixtures(outputRoot, fixtures());
}

// Entry-point guard, intentionally false whenever this module is imported
// (including by tests); the true branch is exercised by the subprocess CLI
// test instead.
/* v8 ignore start */
if (import.meta.main) {
    await runAudioFixtureCli(buildBgmFixtures, verifyBgmFixtures);
}
/* v8 ignore stop */
