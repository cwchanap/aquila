/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        currentLocale?: string;
        session?: {
            user: {
                id: string;
                name?: string | null;
                email?: string | null;
            };
        };
    }
}
