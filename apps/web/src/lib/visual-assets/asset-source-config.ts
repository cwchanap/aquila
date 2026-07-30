import type { AssetResolverSource } from '@aquila/stories/runtime-assets';
import { isPreviewId } from '@aquila/stories/runtime-assets';

export type AssetSourceConfig = {
    baseUrl?: string;
    environment?: string;
    previewId?: string;
};

const LOCAL_PREVIEW_ID = 'hpa-228-local';

function readTrimmed(
    env: Record<string, unknown>,
    key: string
): string | undefined {
    const raw = env[key];
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The only place in the web app that reads asset environment variables.
 * Everything downstream takes an explicit config, so unit tests never depend
 * on ambient env — which also sidesteps Vitest's default VITE_ envPrefix
 * leaving PUBLIC_* undefined in tests but defined under Astro.
 */
export function readAssetSourceConfigFromEnv(
    env: Record<string, unknown>
): AssetSourceConfig {
    const config: AssetSourceConfig = {};
    const baseUrl = readTrimmed(env, 'PUBLIC_ASSET_BASE_URL');
    const environment = readTrimmed(env, 'PUBLIC_ASSET_ENVIRONMENT');
    const previewId = readTrimmed(env, 'PUBLIC_ASSET_PREVIEW_ID');
    if (baseUrl !== undefined) config.baseUrl = baseUrl;
    if (environment !== undefined) config.environment = environment;
    if (previewId !== undefined) config.previewId = previewId;
    return config;
}

function requireHttps(baseUrl: string): void {
    if (!baseUrl.startsWith('https:')) {
        throw new Error(
            `Remote asset base URL must be HTTPS, received: ${baseUrl}`
        );
    }
}

export function resolveAssetSource(
    storyId: string,
    origin: string,
    config: AssetSourceConfig
): AssetResolverSource {
    const { baseUrl, environment, previewId } = config;

    if (!baseUrl && !environment && !previewId) {
        return {
            environment: 'local',
            storyId,
            baseUrl: new URL('/assets/', origin).href,
            target: { kind: 'preview', previewId: LOCAL_PREVIEW_ID },
        };
    }

    if (!baseUrl || !environment) {
        // Name the stray preview id when it is what tripped the check —
        // otherwise the message points only at the two variables the deployer
        // did not set, and never at the one they did.
        const stray = previewId
            ? ` PUBLIC_ASSET_PREVIEW_ID is set (${previewId}) but does nothing on its own.`
            : '';
        throw new Error(
            `Incomplete asset configuration: PUBLIC_ASSET_BASE_URL and PUBLIC_ASSET_ENVIRONMENT must be set together.${stray}`
        );
    }

    if (environment === 'local') {
        if (previewId) {
            throw new Error(
                'Preview id is meaningless when PUBLIC_ASSET_ENVIRONMENT is local.'
            );
        }
        return {
            environment: 'local',
            storyId,
            baseUrl,
            target: { kind: 'preview', previewId: LOCAL_PREVIEW_ID },
        };
    }

    if (environment === 'preview') {
        requireHttps(baseUrl);
        if (!previewId) {
            throw new Error(
                'PUBLIC_ASSET_ENVIRONMENT=preview requires a preview id.'
            );
        }
        if (!isPreviewId(previewId)) {
            throw new Error(`Invalid preview id: ${previewId}`);
        }
        return {
            environment: 'preview',
            storyId,
            baseUrl,
            target: { kind: 'preview', previewId },
        };
    }

    if (environment === 'production') {
        requireHttps(baseUrl);
        if (previewId) {
            throw new Error(
                'Preview id is meaningless when PUBLIC_ASSET_ENVIRONMENT is production.'
            );
        }
        return {
            environment: 'production',
            storyId,
            baseUrl,
            target: { kind: 'production' },
        };
    }

    throw new Error(`Unknown environment: ${environment}`);
}
