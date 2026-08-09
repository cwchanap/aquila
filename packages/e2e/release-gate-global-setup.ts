import { request, type FullConfig } from '@playwright/test';
import {
    RELEASE_GATE_STORAGE_STATE_PATH,
    resolveAutomationBypassHeaders,
} from './release-gate-automation';

export default async function releaseGateGlobalSetup(
    config: FullConfig
): Promise<void> {
    const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (!secret) {
        return;
    }

    const baseURL = config.projects[0]?.use.baseURL;
    if (typeof baseURL !== 'string') {
        throw new Error(
            'release-gate-global-setup.ts: the release gate requires a string baseURL'
        );
    }

    const headers = resolveAutomationBypassHeaders(
        secret,
        baseURL,
        new URL(baseURL).origin
    );
    const bootstrap = await request.newContext({
        baseURL,
        extraHTTPHeaders: headers,
    });
    try {
        const response = await bootstrap.get('/');
        if (!response.ok()) {
            throw new Error(
                'release-gate-global-setup.ts: Vercel automation bypass ' +
                    `bootstrap returned HTTP ${response.status()}`
            );
        }
        await bootstrap.storageState({ path: RELEASE_GATE_STORAGE_STATE_PATH });
    } finally {
        await bootstrap.dispose();
    }
}
