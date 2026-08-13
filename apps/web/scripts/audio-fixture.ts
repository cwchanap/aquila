import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const AUDIO_FIXTURE_SAMPLE_RATE = 8_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function pcm16Wav(samples: Int16Array): Buffer {
    const dataBytes = samples.length * 2;
    const buffer = Buffer.alloc(44 + dataBytes);
    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(36 + dataBytes, 4);
    buffer.write('WAVE', 8, 'ascii');
    buffer.write('fmt ', 12, 'ascii');
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(CHANNELS, 22);
    buffer.writeUInt32LE(AUDIO_FIXTURE_SAMPLE_RATE, 24);
    buffer.writeUInt32LE(AUDIO_FIXTURE_SAMPLE_RATE * CHANNELS * 2, 28);
    buffer.writeUInt16LE(CHANNELS * 2, 32);
    buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
    buffer.write('data', 36, 'ascii');
    buffer.writeUInt32LE(dataBytes, 40);
    for (let i = 0; i < samples.length; i += 1) {
        buffer.writeInt16LE(samples[i], 44 + i * 2);
    }
    return buffer;
}

export function synthPcm16Wav(
    durationMs: number,
    sampleAt: (timeSeconds: number, progress: number) => number
): Buffer {
    const count = Math.round((AUDIO_FIXTURE_SAMPLE_RATE * durationMs) / 1000);
    const samples = new Int16Array(count);
    for (let i = 0; i < count; i += 1) {
        const t = i / AUDIO_FIXTURE_SAMPLE_RATE;
        const progress = i / Math.max(1, count - 1);
        const value = Math.max(-1, Math.min(1, sampleAt(t, progress)));
        samples[i] = Math.round(value * 0x7fff);
    }
    return pcm16Wav(samples);
}

export function verifyPcm16Wav(name: string, bytes: Buffer): void {
    if (bytes.toString('ascii', 0, 4) !== 'RIFF')
        throw new Error(`${name}: RIFF`);
    if (bytes.toString('ascii', 8, 12) !== 'WAVE')
        throw new Error(`${name}: WAVE`);
    if (bytes.toString('ascii', 12, 16) !== 'fmt ')
        throw new Error(`${name}: fmt`);
    if (bytes.readUInt16LE(20) !== 1) throw new Error(`${name}: not PCM`);
    if (bytes.readUInt16LE(22) !== 1) throw new Error(`${name}: not mono`);
    if (bytes.readUInt16LE(34) !== 16) throw new Error(`${name}: not PCM-16`);
    if (bytes.toString('ascii', 36, 40) !== 'data')
        throw new Error(`${name}: data`);
    const dataBytes = bytes.readUInt32LE(40);
    if (dataBytes <= 0 || bytes.length !== 44 + dataBytes) {
        throw new Error(`${name}: invalid data length`);
    }
}

export async function buildAudioFixtures(
    outputRoot: string,
    fixtures: Readonly<Record<string, Buffer>>
): Promise<void> {
    for (const [name, bytes] of Object.entries(fixtures)) {
        const path = resolve(outputRoot, name);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
    }
}

export async function verifyAudioFixtures(
    outputRoot: string,
    fixtures: Readonly<Record<string, Buffer>>
): Promise<void> {
    for (const [name, expected] of Object.entries(fixtures)) {
        const actual = await readFile(resolve(outputRoot, name));
        verifyPcm16Wav(name, actual);
        if (!actual.equals(expected)) {
            throw new Error(
                `${name}: committed bytes differ from deterministic generator`
            );
        }
    }
}

export async function runAudioFixtureCli(
    build: () => Promise<void>,
    verify: () => Promise<void>
): Promise<void> {
    if (process.argv.includes('--verify')) await verify();
    else await build();
}
