import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SAMPLE_RATE = 8_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const webRoot = process.cwd();
const outputRoot = resolve(webRoot, 'public/assets/vn/audio/sfx');

function pcm16Wav(samples: Int16Array): Buffer {
    const dataBytes = samples.length * 2;
    const buffer = Buffer.alloc(44 + dataBytes);
    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(36 + dataBytes, 4);
    buffer.write('WAVE', 8, 'ascii');
    buffer.write('fmt ', 12, 'ascii');
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(CHANNELS, 22);
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
    buffer.writeUInt16LE(CHANNELS * 2, 32);
    buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
    buffer.write('data', 36, 'ascii');
    buffer.writeUInt32LE(dataBytes, 40);
    for (let i = 0; i < samples.length; i += 1) {
        buffer.writeInt16LE(samples[i], 44 + i * 2);
    }
    return buffer;
}

function synth(
    durationMs: number,
    sampleAt: (timeSeconds: number, progress: number) => number
): Buffer {
    const count = Math.round((SAMPLE_RATE * durationMs) / 1000);
    const samples = new Int16Array(count);
    for (let i = 0; i < count; i += 1) {
        const t = i / SAMPLE_RATE;
        const progress = i / Math.max(1, count - 1);
        const value = Math.max(-1, Math.min(1, sampleAt(t, progress)));
        samples[i] = Math.round(value * 0x7fff);
    }
    return pcm16Wav(samples);
}

function fixtures(): Record<string, Buffer> {
    return {
        'notification-beep.wav': synth(
            180,
            (t, p) =>
                Math.sin(2 * Math.PI * 880 * t) * Math.sin(Math.PI * p) * 0.5
        ),
        'impact.wav': synth(
            220,
            (t, p) => Math.sin(2 * Math.PI * 95 * t) * Math.exp(-7 * p) * 0.9
        ),
        'door-open.wav': synth(450, (t, p) => {
            const frequency = 150 - 70 * p;
            return Math.sin(2 * Math.PI * frequency * t) * (1 - p) * 0.55;
        }),
    };
}

function verifyWav(name: string, bytes: Buffer): void {
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

export async function buildSfxFixtures(): Promise<void> {
    for (const [name, bytes] of Object.entries(fixtures())) {
        const path = resolve(outputRoot, name);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
    }
}

export async function verifySfxFixtures(): Promise<void> {
    for (const [name, expected] of Object.entries(fixtures())) {
        const actual = await readFile(resolve(outputRoot, name));
        verifyWav(name, actual);
        if (!actual.equals(expected)) {
            throw new Error(
                `${name}: committed bytes differ from deterministic generator`
            );
        }
    }
}

if (import.meta.main) {
    if (process.argv.includes('--verify')) await verifySfxFixtures();
    else await buildSfxFixtures();
}
