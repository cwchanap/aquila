import { describe, expect, it, vi } from 'vitest';
import { buildAudioGenerationSpec } from '../spec';
import {
    createElevenLabsAudioProvider,
    ElevenLabsProviderError,
} from '../elevenlabs';

const SFX_BYTES = Uint8Array.from([0x49, 0x44, 0x33, 0x04, 0x00]);
const BGM_BYTES = Uint8Array.from([0x49, 0x44, 0x33, 0x05, 0x00]);

function sfxSpec() {
    return buildAudioGenerationSpec({
        key: 'door-open',
        type: 'sfx',
        prompt: 'Heavy apartment door opening',
        durationMs: 2_200,
    });
}

function bgmSpec() {
    return buildAudioGenerationSpec({
        key: 'dawn-apartment',
        type: 'bgm',
        prompt: 'Cold Tokyo dawn underscore',
        durationMs: 90_000,
        loop: true,
    });
}

function audioResponse(
    bytes: Uint8Array = SFX_BYTES,
    status = 200,
    contentType = 'audio/mpeg',
    headers: Record<string, string> = {}
): Response {
    return new Response(bytes, {
        status,
        headers: {
            'content-type': contentType,
            ...headers,
        },
    });
}

function jsonResponse(status: number): Response {
    return new Response('{"error":"provider failure"}', {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function providerFor(
    responses: Response[],
    sleep = vi.fn(async () => undefined)
) {
    const fetchMock = vi.fn(async () => responses.shift()!);
    const provider = createElevenLabsAudioProvider({
        fetch: fetchMock,
        sleep,
    });
    return { fetchMock, provider, sleep };
}

describe('ElevenLabs audio provider', () => {
    it('maps SFX to the exact observed HTTP request and candidate fields', async () => {
        const { fetchMock, provider } = providerFor([
            audioResponse(SFX_BYTES, 200, 'audio/mpeg', {
                'content-length': String(SFX_BYTES.byteLength),
                'character-cost': '5',
                'x-trace-id': 'trace-sfx',
                'request-id': 'not-approved',
                authorization: 'Bearer test-secret',
            }),
        ]);

        const generated = await provider.generate(sfxSpec(), 'test-secret');

        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'xi-api-key': 'test-secret',
                }),
                body: JSON.stringify({
                    text: 'Heavy apartment door opening',
                    duration_seconds: 2.2,
                    loop: false,
                    prompt_influence: 0.3,
                    model_id: 'eleven_text_to_sound_v2',
                }),
            })
        );
        expect(generated).toMatchObject({
            bytes: SFX_BYTES,
            mediaType: 'audio/mpeg',
            format: 'mp3',
            intendedDurationMs: 2_200,
            actualDurationMs: null,
            providerMetadata: {
                'content-type': 'audio/mpeg',
                'content-length': String(SFX_BYTES.byteLength),
                'character-cost': '5',
                'x-trace-id': 'trace-sfx',
            },
        });
        expect(JSON.stringify(generated.providerMetadata)).not.toContain(
            'test-secret'
        );
    });

    it('maps BGM to the exact observed instrumental music request', async () => {
        const { fetchMock, provider } = providerFor([
            audioResponse(BGM_BYTES, 200, 'audio/mpeg', {
                'content-length': String(BGM_BYTES.byteLength),
                'song-id': 'song-bgm',
                'x-trace-id': 'trace-bgm',
            }),
        ]);

        const generated = await provider.generate(bgmSpec(), 'test-secret');

        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.elevenlabs.io/v1/music?output_format=auto',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'xi-api-key': 'test-secret',
                }),
                body: JSON.stringify({
                    prompt: 'Cold Tokyo dawn underscore',
                    music_length_ms: 90_000,
                    model_id: 'music_v2',
                    force_instrumental: true,
                    store_for_inpainting: false,
                    sign_with_c2pa: false,
                }),
            })
        );
        expect(generated).toMatchObject({
            bytes: BGM_BYTES,
            mediaType: 'audio/mpeg',
            format: 'mp3',
            intendedDurationMs: 90_000,
            actualDurationMs: null,
            providerMetadata: {
                'content-type': 'audio/mpeg',
                'content-length': String(BGM_BYTES.byteLength),
                'song-id': 'song-bgm',
                'x-trace-id': 'trace-bgm',
            },
        });
    });

    it('accepts parameterized audio media types and derives a safe extension', async () => {
        const { provider } = providerFor([
            audioResponse(SFX_BYTES, 200, 'audio/ogg; codecs=opus', {
                'x-trace-id': 'trace-ogg',
            }),
        ]);

        await expect(
            provider.generate(sfxSpec(), 'test-secret')
        ).resolves.toMatchObject({
            mediaType: 'audio/ogg',
            format: 'ogg',
            providerMetadata: {
                'content-type': 'audio/ogg; codecs=opus',
                'x-trace-id': 'trace-ogg',
            },
        });
    });

    it('rejects a successful non-audio response without retrying', async () => {
        const sleep = vi.fn(async () => undefined);
        const { fetchMock, provider } = providerFor([jsonResponse(200)], sleep);

        const error = await provider
            .generate(sfxSpec(), 'test-secret')
            .catch(cause => cause);

        expect(error).toBeInstanceOf(ElevenLabsProviderError);
        expect(error).toMatchObject({
            kind: 'invalid-response',
            status: 200,
        });
        expect(error.message).toContain('application/json');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it('rejects an empty successful audio response without retrying', async () => {
        const sleep = vi.fn(async () => undefined);
        const { fetchMock, provider } = providerFor(
            [audioResponse(new Uint8Array(), 200, 'audio/mpeg')],
            sleep
        );

        await expect(
            provider.generate(sfxSpec(), 'test-secret')
        ).rejects.toMatchObject({
            kind: 'invalid-response',
            status: 200,
            contentType: 'audio/mpeg',
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it('retries a 429 once with the injected one-second backoff', async () => {
        const sleep = vi.fn(async () => undefined);
        const { fetchMock, provider } = providerFor(
            [jsonResponse(429), audioResponse()],
            sleep
        );

        await expect(
            provider.generate(sfxSpec(), 'test-secret')
        ).resolves.toMatchObject({
            mediaType: 'audio/mpeg',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledWith(1_000);
    });

    it('retries 5xx responses at most twice with one- and two-second backoffs', async () => {
        const sleep = vi.fn(async () => undefined);
        const { fetchMock, provider } = providerFor(
            [jsonResponse(500), jsonResponse(503), audioResponse()],
            sleep
        );

        await expect(
            provider.generate(sfxSpec(), 'test-secret')
        ).resolves.toMatchObject({
            mediaType: 'audio/mpeg',
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(sleep).toHaveBeenNthCalledWith(1, 1_000);
        expect(sleep).toHaveBeenNthCalledWith(2, 2_000);
    });

    it('returns the final retryable status after the third 5xx response', async () => {
        const sleep = vi.fn(async () => undefined);
        const { fetchMock, provider } = providerFor(
            [jsonResponse(500), jsonResponse(503), jsonResponse(500)],
            sleep
        );

        const error = await provider
            .generate(sfxSpec(), 'test-secret')
            .catch(cause => cause);

        expect(error).toMatchObject({
            kind: 'retryable-status',
            status: 500,
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(sleep).toHaveBeenNthCalledWith(1, 1_000);
        expect(sleep).toHaveBeenNthCalledWith(2, 2_000);
    });

    it('does not retry deterministic 4xx responses', async () => {
        const sleep = vi.fn(async () => undefined);
        const { fetchMock, provider } = providerFor([jsonResponse(400)], sleep);

        const error = await provider
            .generate(sfxSpec(), 'test-secret')
            .catch(cause => cause);

        expect(error).toMatchObject({
            kind: 'non-retryable-status',
            status: 400,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it('does not retry thrown network errors or expose the API key', async () => {
        const fetchMock = vi.fn(async () => {
            throw new Error('socket reset while using test-secret');
        });
        const sleep = vi.fn(async () => undefined);
        const provider = createElevenLabsAudioProvider({
            fetch: fetchMock,
            sleep,
        });

        const error = await provider
            .generate(sfxSpec(), 'test-secret')
            .catch(cause => cause);

        expect(error).toMatchObject({ kind: 'network', status: null });
        expect(error.message).not.toContain('test-secret');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });
});
