// Stub for astro:middleware virtual module used in unit tests.
// The real module is provided by the Astro runtime during builds.

type MiddlewareFn = (context: unknown, next: () => unknown) => unknown;

export const defineMiddleware = (fn: MiddlewareFn) => fn;
