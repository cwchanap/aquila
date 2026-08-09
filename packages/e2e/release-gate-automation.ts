import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const RELEASE_GATE_STORAGE_STATE_PATH = join(
    process.env.RUNNER_TEMP ?? tmpdir(),
    'aquila-release-gate-storage-state.json'
);

export function resolveAutomationBypassHeaders(
    secret: string | undefined,
    requestUrl: string,
    protectedOrigin: string
): Record<string, string> | undefined {
    if (!secret || new URL(requestUrl).origin !== protectedOrigin) {
        return undefined;
    }
    return {
        'x-vercel-protection-bypass': secret,
        'x-vercel-set-bypass-cookie': 'true',
    };
}
