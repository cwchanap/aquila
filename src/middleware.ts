import { defineMiddleware } from "astro:middleware"
import { redirectToDefaultLocale } from "astro:i18n"

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context;
  const { pathname } = url;
  const pathParts = pathname.split('/').filter(Boolean);
  const locale = pathParts[0];

  if (locale && ['en', 'zh'].includes(locale)) {
    (context.locals as any).currentLocale = locale;
  } else {
    // No locale or invalid, redirect to default locale
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/en/',
      },
    });
  }

  const response = await next();

  if (response.status === 404) {
    // Fallback to default locale
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/en/',
      },
    });
  }

  return response;
});