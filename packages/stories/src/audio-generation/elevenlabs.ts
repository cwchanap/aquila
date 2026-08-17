import type { CurrentAudioGenerationSpec } from './spec';
import type { GeneratedAudioCandidate } from './store';

const SFX_URL =
    'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';
const BGM_URL = 'https://api.elevenlabs.io/v1/music?output_format=auto';
const RETRY_DELAYS_MS = [1_000, 2_000] as const;
const DEFAULT_REQUEST_TIMEOUT_MS = 300_000;
const APPROVED_RESPONSE_HEADERS = [
    'content-type',
    'content-length',
    'character-cost',
    'song-id',
    'x-trace-id',
] as const;

export interface AudioGenerationProvider {
    generate(
        spec: CurrentAudioGenerationSpec,
        apiKey: string
    ): Promise<GeneratedAudioCandidate>;
}

export type ElevenLabsProviderErrorKind =
    | 'retryable-status'
    | 'non-retryable-status'
    | 'invalid-response'
    | 'network';

export class ElevenLabsProviderError extends Error {
    constructor(
        readonly kind: ElevenLabsProviderErrorKind,
        message: string,
        readonly status: number | null = null,
        readonly contentType: string | null = null
    ) {
        super(message);
        this.name = 'ElevenLabsProviderError';
    }
}

export interface ElevenLabsAudioProviderOptions {
    readonly fetch?: typeof fetch;
    readonly sleep?: (milliseconds: number) => Promise<void>;
    readonly requestTimeoutMs?: number;
}

function defaultSleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function redact(value: string, apiKey: string): string {
    return apiKey ? value.split(apiKey).join('[redacted]') : value;
}

function requestForSpec(spec: CurrentAudioGenerationSpec): {
    readonly url: string;
    readonly body: Record<string, unknown>;
} {
    if (spec.type === 'sfx') {
        return {
            url: SFX_URL,
            body: {
                text: spec.prompt,
                duration_seconds: spec.durationMs / 1_000,
                loop: spec.loop,
                prompt_influence: spec.promptInfluence,
                model_id: spec.modelId,
            },
        };
    }

    return {
        url: BGM_URL,
        body: {
            prompt: spec.prompt,
            music_length_ms: spec.durationMs,
            model_id: spec.modelId,
            force_instrumental: spec.forceInstrumental,
            store_for_inpainting: false,
            sign_with_c2pa: false,
        },
    };
}

function audioFormat(contentType: string | null): {
    readonly mediaType: string;
    readonly format: string;
} | null {
    const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    if (!mediaType.startsWith('audio/')) return null;

    const subtype = mediaType.slice('audio/'.length);
    if (!/^[a-z0-9][a-z0-9+.-]*$/.test(subtype)) return null;

    return {
        mediaType,
        format:
            subtype === 'mpeg'
                ? 'mp3'
                : subtype.startsWith('x-') && subtype.length > 2
                  ? subtype.slice(2)
                  : subtype,
    };
}

function approvedResponseHeaders(
    headers: Headers,
    apiKey: string
): Record<string, string> {
    const metadata: Record<string, string> = {};
    for (const name of APPROVED_RESPONSE_HEADERS) {
        const value = headers.get(name);
        if (value !== null) metadata[name] = redact(value, apiKey);
    }
    return metadata;
}

function errorMessage(error: unknown, apiKey: string): string {
    const message = error instanceof Error ? error.message : String(error);
    return redact(message, apiKey);
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || (status >= 500 && status <= 599);
}

export function createElevenLabsAudioProvider(
    options: ElevenLabsAudioProviderOptions = {}
): AudioGenerationProvider {
    const fetchImpl = options.fetch ?? fetch;
    const sleep = options.sleep ?? defaultSleep;
    const requestTimeoutMs =
        options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    return {
        async generate(spec, apiKey) {
            const request = requestForSpec(spec);
            const body = JSON.stringify(request.body);

            for (let attempt = 0; attempt < 3; attempt += 1) {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    requestTimeoutMs
                );
                try {
                    let response: Response;
                    try {
                        response = await fetchImpl(request.url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'xi-api-key': apiKey,
                            },
                            body,
                            signal: controller.signal,
                        });
                    } catch (error) {
                        throw new ElevenLabsProviderError(
                            'network',
                            controller.signal.aborted
                                ? `ElevenLabs request timed out after ${requestTimeoutMs}ms`
                                : `ElevenLabs request failed: ${errorMessage(error, apiKey)}`
                        );
                    }

                    if (response.status >= 200 && response.status <= 299) {
                        const rawContentType =
                            response.headers.get('content-type');
                        const audio = audioFormat(rawContentType);
                        if (audio === null) {
                            const displayedContentType =
                                rawContentType ?? 'missing';
                            throw new ElevenLabsProviderError(
                                'invalid-response',
                                `ElevenLabs returned HTTP ${response.status} with non-audio content-type ${redact(displayedContentType, apiKey)}`,
                                response.status,
                                redact(rawContentType ?? '', apiKey) || null
                            );
                        }

                        let bytes: Uint8Array;
                        try {
                            bytes = new Uint8Array(
                                await response.arrayBuffer()
                            );
                        } catch (error) {
                            throw new ElevenLabsProviderError(
                                'network',
                                controller.signal.aborted
                                    ? `ElevenLabs request timed out after ${requestTimeoutMs}ms while reading audio body`
                                    : `Reading ElevenLabs audio failed: ${errorMessage(error, apiKey)}`
                            );
                        }
                        if (bytes.byteLength === 0) {
                            throw new ElevenLabsProviderError(
                                'invalid-response',
                                `ElevenLabs returned HTTP ${response.status} with an empty audio body`,
                                response.status,
                                redact(rawContentType ?? '', apiKey) || null
                            );
                        }

                        return {
                            bytes,
                            mediaType: audio.mediaType,
                            format: audio.format,
                            providerMetadata: approvedResponseHeaders(
                                response.headers,
                                apiKey
                            ),
                            intendedDurationMs: spec.durationMs,
                            actualDurationMs: null,
                        };
                    }

                    const retryable = isRetryableStatus(response.status);
                    if (retryable && attempt < RETRY_DELAYS_MS.length) {
                        await sleep(RETRY_DELAYS_MS[attempt]);
                        continue;
                    }

                    const rawContentType = response.headers.get('content-type');
                    const displayedContentType = rawContentType
                        ? ` (${redact(rawContentType, apiKey)})`
                        : '';
                    throw new ElevenLabsProviderError(
                        retryable ? 'retryable-status' : 'non-retryable-status',
                        `ElevenLabs returned HTTP ${response.status}${displayedContentType}`,
                        response.status,
                        redact(rawContentType ?? '', apiKey) || null
                    );
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            throw new Error('Unreachable ElevenLabs retry state');
        },
    };
}
