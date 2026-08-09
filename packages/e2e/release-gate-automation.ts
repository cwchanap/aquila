export function resolveAutomationBypassHeaders(
    secret: string | undefined
): Record<string, string> | undefined {
    if (!secret) {
        return undefined;
    }
    return {
        'x-vercel-protection-bypass': secret,
        'x-vercel-set-bypass-cookie': 'true',
    };
}
