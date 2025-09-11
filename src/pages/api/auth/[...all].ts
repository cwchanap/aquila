import type { APIRoute } from 'astro';
import { auth } from '../../../lib/auth.js';

export const ALL: APIRoute = async context => {
    return auth.handler(context.request);
};
