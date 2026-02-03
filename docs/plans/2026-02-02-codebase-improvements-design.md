# Codebase Improvements Design

**Date:** 2026-02-02
**Scope:** Comprehensive sprint addressing 16 architectural improvements

## Overview

This design addresses all issues identified in the codebase analysis, organized into logical groups:

1. **Security & Authentication** - Secure endpoints, consolidate on Better Auth
2. **Input Validation** - Add Zod for type-safe validation
3. **Testing Infrastructure** - Add tests for game/dialogue packages, typed test utilities
4. **Architecture Refactoring** - Scene registry, transactions, base repository
5. **Code Quality** - API response standardization, error boundaries, cleanup

---

## 1. Security & Authentication

### 1.1 Secure User Management Endpoints

**Files:** `apps/web/src/pages/api/users.ts`, `apps/web/src/pages/api/users/[id].ts`

Add authentication to all user endpoints:
- GET `/api/users` - Authenticated users can only retrieve their own data
- POST `/api/users` - Remove (Better Auth handles registration)
- GET/PUT/DELETE `/api/users/[id]` - Users can only access their own record

```typescript
export const GET: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return errorResponse('Unauthorized', 401);
    }
    const user = await userRepo.findById(session.user.id);
    return jsonResponse(user ? [user] : []);
};
```

### 1.2 Consolidate on Better Auth

**Files to update:**
- `apps/web/src/lib/api-utils.ts` - New `requireAuth()` helper using Better Auth
- `apps/web/src/pages/api/stories/*.ts` - Migrate from `requireSession()`
- `apps/web/src/pages/api/bookmarks/*.ts` - Standardize pattern
- `apps/web/src/lib/simple-auth.ts` - Remove after migration

**New unified helper:**
```typescript
// apps/web/src/lib/api-utils.ts
import { auth } from '@/lib/auth';

export async function requireAuth(request: Request) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
        return { session: null, error: errorResponse('Unauthorized', 401) };
    }
    return { session, error: null };
}
```

---

## 2. Input Validation with Zod

### 2.1 Install Zod

```bash
bun add zod --filter web
```

### 2.2 Schema Definitions

**New file:** `apps/web/src/lib/schemas.ts`

```typescript
import { z } from 'zod';

// Story schemas
export const StoryCreateSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().optional(),
    coverImage: z.string().url('Invalid cover image URL').optional(),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

export const StoryUpdateSchema = StoryCreateSchema.partial();

// Bookmark schemas
export const BookmarkCreateSchema = z.object({
    storyId: z.string().min(1, 'Story ID is required'),
    sceneId: z.string().min(1, 'Scene ID is required'),
    bookmarkName: z.string().min(1).max(100),
    locale: z.enum(['en', 'zh']).default('en'),
});

export const BookmarkUpdateSchema = z.object({
    sceneId: z.string().min(1).optional(),
    bookmarkName: z.string().min(1).max(100).optional(),
    locale: z.enum(['en', 'zh']).optional(),
});

// User schemas
export const UserUpdateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional(),
});
```

### 2.3 Validation Helper

**Update:** `apps/web/src/lib/api-utils.ts`

```typescript
import { z, ZodSchema } from 'zod';

export async function parseBody<T>(
    request: Request,
    schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: Response }> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return { data: null, error: errorResponse('Malformed JSON', 400) };
    }

    const result = schema.safeParse(body);
    if (!result.success) {
        const message = result.error.issues[0]?.message || 'Validation failed';
        return { data: null, error: errorResponse(message, 400) };
    }
    return { data: result.data, error: null };
}
```

---

## 3. Testing Infrastructure

### 3.1 Game Package Tests

**New files:**
- `packages/game/vitest.config.ts`
- `packages/game/src/__tests__/SceneFlow.test.ts`
- `packages/game/src/__tests__/CheckpointStorage.test.ts`
- `packages/game/src/__tests__/SceneRegistry.test.ts`

**Config:**
```typescript
// packages/game/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.test.ts'],
    },
});
```

**Update package.json:**
```json
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest"
    },
    "devDependencies": {
        "vitest": "^2.0.0",
        "jsdom": "^24.0.0"
    }
}
```

### 3.2 Dialogue Package Tests

**New files:**
- `packages/dialogue/vitest.config.ts`
- `packages/dialogue/src/__tests__/CharacterDirectory.test.ts`
- `packages/dialogue/src/__tests__/stories.test.ts`
- `packages/dialogue/src/__tests__/translations.test.ts`

### 3.3 Typed Test Utilities

**New files:**
- `apps/web/src/lib/test-utils/api-context.ts`
- `apps/web/src/lib/test-utils/mock-db.ts`
- `apps/web/src/lib/test-utils/index.ts`

```typescript
// apps/web/src/lib/test-utils/api-context.ts
import type { APIContext, AstroCookies } from 'astro';
import { vi } from 'vitest';

export function createMockCookies(): AstroCookies {
    const store = new Map<string, string>();
    return {
        get: vi.fn((key: string) => store.get(key)),
        set: vi.fn((key: string, value: string) => store.set(key, value)),
        delete: vi.fn((key: string) => store.delete(key)),
        has: vi.fn((key: string) => store.has(key)),
    } as unknown as AstroCookies;
}

export function createMockAPIContext(overrides: Partial<APIContext> = {}): APIContext {
    const url = new URL('http://localhost:5090');
    return {
        params: {},
        request: new Request(url),
        cookies: createMockCookies(),
        url,
        site: url,
        locals: {},
        redirect: (path: string) => Response.redirect(new URL(path, url)),
        ...overrides,
    } as APIContext;
}

export function createAuthenticatedContext(
    userId: string,
    overrides: Partial<APIContext> = {}
): APIContext {
    return createMockAPIContext({
        ...overrides,
        locals: { session: { user: { id: userId } }, ...overrides.locals },
    });
}
```

```typescript
// apps/web/src/lib/test-utils/mock-db.ts
import { vi } from 'vitest';

export function createMockDb() {
    return {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        transaction: vi.fn((fn) => fn(createMockDb())),
    };
}
```

---

## 4. Architecture Refactoring

### 4.1 Scene Registry Pattern

**Update:** `packages/game/src/SceneDirectory.ts`

Replace hardcoded `SceneId` union with runtime registry:

```typescript
export interface SceneConfig {
    id: string;
    label: string;
    backgroundTextureKey: string;
    ambientFrequency: number;
    fallbackColor: number;
}

export class SceneRegistry {
    private static scenes: Map<string, SceneConfig> = new Map();
    private static initialized = false;

    static register(config: SceneConfig): void {
        this.scenes.set(config.id, config);
    }

    static registerMany(configs: SceneConfig[]): void {
        configs.forEach(config => this.register(config));
    }

    static get(id: string): SceneConfig | undefined {
        return this.scenes.get(id);
    }

    static has(id: string): boolean {
        return this.scenes.has(id);
    }

    static all(): SceneConfig[] {
        return Array.from(this.scenes.values());
    }

    static clear(): void {
        this.scenes.clear();
    }
}

// Keep SceneDirectory as facade for backward compatibility
export const SceneDirectory = {
    getInfo: (id: string) => SceneRegistry.get(id),
    // ... other methods delegate to SceneRegistry
};
```

**Update:** `packages/dialogue/src/stories/*/index.ts`

Stories register their scenes on load:

```typescript
// packages/dialogue/src/stories/trainAdventure/index.ts
import { SceneRegistry } from '@aquila/game';

export const trainAdventureScenes: SceneConfig[] = [
    { id: 'scene_1', label: 'Train Station', backgroundTextureKey: 'station', ambientFrequency: 440, fallbackColor: 0x1a1a2e },
    // ...
];

// Auto-register when imported
SceneRegistry.registerMany(trainAdventureScenes);
```

### 4.2 Transaction Handling

**Update:** `apps/web/src/lib/drizzle/repositories.ts`

Wrap multi-step operations in transactions:

```typescript
async upsertByScene(
    userId: string,
    storyId: string,
    sceneId: string,
    bookmarkName: string,
    locale: string = 'en'
): Promise<Bookmark> {
    return await this.db.transaction(async (tx) => {
        const [existing] = await tx
            .select()
            .from(bookmarks)
            .where(
                and(
                    eq(bookmarks.userId, userId),
                    eq(bookmarks.storyId, storyId),
                    eq(bookmarks.bookmarkName, bookmarkName)
                )
            )
            .limit(1);

        if (existing) {
            const [updated] = await tx
                .update(bookmarks)
                .set({ sceneId, locale, updatedAt: new Date() })
                .where(eq(bookmarks.id, existing.id))
                .returning();
            return updated;
        }

        const id = nanoid();
        const [bookmark] = await tx
            .insert(bookmarks)
            .values({ id, userId, storyId, sceneId, bookmarkName, locale })
            .returning();
        return bookmark;
    });
}
```

### 4.3 Abstract Base Repository

**New file:** `apps/web/src/lib/drizzle/base-repository.ts`

```typescript
import { eq } from 'drizzle-orm';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';
import { db, type DrizzleDB } from './db';

export abstract class BaseRepository<TTable extends PgTableWithColumns<any>, TSelect, TInsert> {
    protected db: DrizzleDB;
    protected abstract table: TTable;
    protected abstract idColumn: TTable['id'];

    constructor(dbInstance?: DrizzleDB) {
        this.db = dbInstance || db;
    }

    async findById(id: string): Promise<TSelect | undefined> {
        const [result] = await this.db
            .select()
            .from(this.table)
            .where(eq(this.idColumn, id))
            .limit(1);
        return result as TSelect | undefined;
    }

    async delete(id: string): Promise<boolean> {
        const deleted = await this.db
            .delete(this.table)
            .where(eq(this.idColumn, id))
            .returning({ id: this.idColumn });
        return deleted.length > 0;
    }
}
```

---

## 5. Code Quality Improvements

### 5.1 Standardize API Response Format

**Update:** `apps/web/src/lib/api-utils.ts`

```typescript
interface ApiSuccessResponse<T> {
    data: T;
    success: true;
}

interface ApiErrorResponse {
    error: string;
    errorId?: string;
    success: false;
}

export function jsonResponse<T>(data: T, status = 200): Response {
    const body: ApiSuccessResponse<T> = { data, success: true };
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function errorResponse(error: string, status: number, errorId?: string): Response {
    const body: ApiErrorResponse = { error, success: false, ...(errorId && { errorId }) };
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
```

### 5.2 Fix Middleware Type Safety

**Update:** `apps/web/src/env.d.ts`

```typescript
declare namespace App {
    interface Locals {
        currentLocale?: string;
        session?: {
            user: {
                id: string;
                name?: string;
                email?: string;
            };
        };
    }
}
```

**Update:** `apps/web/src/middleware.ts`

Remove type assertions, use properly typed locals.

### 5.3 Add Error Boundary to ReaderManager

**Update:** `apps/web/src/lib/reader-manager.ts`

```typescript
async renderReader(): Promise<void> {
    const container = document.getElementById('reader-container');
    if (!container) return;

    try {
        const { default: NovelReader } = await import('@/components/NovelReader.svelte');
        // ... mount component
    } catch (error) {
        console.error('Failed to load reader component:', error);
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center p-4">
                <p class="text-red-400 mb-4">Failed to load reader</p>
                <button
                    onclick="location.reload()"
                    class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded"
                >
                    Retry
                </button>
            </div>
        `;
    }
}
```

### 5.4 Remove Duplicate Translation Logic

**Update:** `apps/web/src/components/MainMenu.svelte`

Replace custom `t()` function with centralized `getTranslations()`:

```typescript
import { getTranslations, type Locale } from '@aquila/dialogue';

$: translations = getTranslations(currentLocale as Locale);

// Use: {translations.menu.heading} instead of {t('menu.heading')}
```

### 5.5 Cleanup Dead Code

- Remove `handleSettingsClick` placeholder or implement settings
- Remove unused `createEventDispatcher` if not needed
- Remove `SimpleAuthService` after Better Auth migration

---

## Implementation Order

1. **Phase 1: Security (Critical)**
   - Secure user endpoints
   - Migrate to Better Auth
   - Add `requireAuth()` helper

2. **Phase 2: Validation**
   - Install Zod
   - Create schemas
   - Add `parseBody()` helper
   - Update all API routes

3. **Phase 3: Testing Infrastructure**
   - Add Vitest to game/dialogue packages
   - Create typed test utilities
   - Write tests for core functionality

4. **Phase 4: Architecture**
   - Implement SceneRegistry
   - Add transaction handling
   - Create BaseRepository

5. **Phase 5: Code Quality**
   - Standardize API responses
   - Fix middleware types
   - Add error boundary
   - Cleanup dead code

---

## Files Changed Summary

### New Files
- `apps/web/src/lib/schemas.ts`
- `apps/web/src/lib/drizzle/base-repository.ts`
- `apps/web/src/lib/test-utils/api-context.ts`
- `apps/web/src/lib/test-utils/mock-db.ts`
- `apps/web/src/lib/test-utils/index.ts`
- `packages/game/vitest.config.ts`
- `packages/game/src/__tests__/*.test.ts`
- `packages/dialogue/vitest.config.ts`
- `packages/dialogue/src/__tests__/*.test.ts`

### Modified Files
- `apps/web/src/lib/api-utils.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/lib/drizzle/repositories.ts`
- `apps/web/src/lib/reader-manager.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/env.d.ts`
- `apps/web/src/pages/api/users.ts`
- `apps/web/src/pages/api/users/[id].ts`
- `apps/web/src/pages/api/stories/*.ts`
- `apps/web/src/pages/api/bookmarks/*.ts`
- `apps/web/src/components/MainMenu.svelte`
- `packages/game/src/SceneDirectory.ts`
- `packages/game/package.json`
- `packages/dialogue/package.json`

### Deleted Files
- `apps/web/src/lib/simple-auth.ts` (after migration verified)
