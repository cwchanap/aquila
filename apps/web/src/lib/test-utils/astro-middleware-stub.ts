// Stub for astro:middleware virtual module used in unit tests.
// The real module is provided by the Astro runtime during builds.

export interface MiddlewareContext {
    url: URL;
    locals: Record<string, string>;
}

type MiddlewareFn = (
    context: MiddlewareContext,
    next: () => Response | Promise<Response>
) => Response | Promise<Response>;

export const defineMiddleware = (fn: MiddlewareFn) => fn;
