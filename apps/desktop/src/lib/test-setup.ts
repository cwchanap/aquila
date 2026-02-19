import { vi } from 'vitest';

Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: vi.fn(() => 'test-uuid-123'),
        getRandomValues: vi.fn((arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = i % 256;
            }
            return arr;
        }),
    },
});
