import { resolve } from 'node:path';
import {
    buildAudioFixtures,
    runAudioFixtureCli,
    synthPcm16Wav,
    verifyAudioFixtures,
} from './audio-fixture';

const outputRoot = resolve(process.cwd(), 'public/assets/vn/audio/sfx');

function fixtures(): Record<string, Buffer> {
    return {
        'notification-beep.wav': synthPcm16Wav(
            180,
            (t, p) =>
                Math.sin(2 * Math.PI * 880 * t) * Math.sin(Math.PI * p) * 0.5
        ),
        'impact.wav': synthPcm16Wav(
            220,
            (t, p) => Math.sin(2 * Math.PI * 95 * t) * Math.exp(-7 * p) * 0.9
        ),
        'door-open.wav': synthPcm16Wav(450, (t, p) => {
            const frequency = 150 - 70 * p;
            return Math.sin(2 * Math.PI * frequency * t) * (1 - p) * 0.55;
        }),
    };
}

export async function buildSfxFixtures(): Promise<void> {
    await buildAudioFixtures(outputRoot, fixtures());
}

export async function verifySfxFixtures(): Promise<void> {
    await verifyAudioFixtures(outputRoot, fixtures());
}

if (import.meta.main) {
    await runAudioFixtureCli(buildSfxFixtures, verifySfxFixtures);
}
