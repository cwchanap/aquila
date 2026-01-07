/**
 * Test utility for creating mock request objects
 *
 * @param cookie - Optional cookie string to include in the request headers
 * @param json - Optional async function that returns JSON data for the request body
 * @returns A mock request object compatible with Astro API route handlers
 */
export const makeRequest = (cookie?: string, json?: () => Promise<any>) =>
    ({
        headers: {
            get: (name: string) =>
                name === 'cookie' ? (cookie ?? null) : null,
        },
        json,
    }) as any;
