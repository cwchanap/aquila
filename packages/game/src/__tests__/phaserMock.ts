/**
 * Global Phaser mock for unit testing.
 *
 * Aliased as the 'phaser' module in vitest.config.ts so every source file that
 * does `import Phaser from 'phaser'` automatically receives this mock during tests.
 *
 * Usage in test files:
 *   import { makeMockScene } from './phaserMock';
 *   const scene = makeMockScene() as any;
 *
 * The `MockScene` class is the extendable base class used by `BaseScene extends Phaser.Scene`.
 */
import { vi } from 'vitest';

// ── Fluent helper ──────────────────────────────────────────────────────────
// Makes every vi.fn() property on `obj` return `obj` so method chains work.
function fluent<T extends Record<string, unknown>>(obj: T): T {
    for (const key of Object.keys(obj)) {
        const v = obj[key];
        if (v !== null && typeof v === 'function' && 'mockReturnValue' in v) {
            (v as ReturnType<typeof vi.fn>).mockReturnValue(obj);
        }
    }
    return obj;
}

// ── Game-object factories (fresh mocks per call) ───────────────────────────

export function makeMockText() {
    return fluent({
        destroy: vi.fn(),
        setText: vi.fn(),
        setStyle: vi.fn(),
        setColor: vi.fn(),
        setOrigin: vi.fn(),
        setAlpha: vi.fn(),
        setDepth: vi.fn(),
        setPosition: vi.fn(),
        setInteractive: vi.fn(),
        disableInteractive: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        text: '',
        y: 0,
    } as Record<string, unknown>);
}

export function makeMockRectangle() {
    return fluent({
        destroy: vi.fn(),
        setDepth: vi.fn(),
        setInteractive: vi.fn(),
        setFillStyle: vi.fn(),
        setStrokeStyle: vi.fn(),
        setPosition: vi.fn(),
        setSize: vi.fn(),
        setOrigin: vi.fn(),
        setAlpha: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
    } as Record<string, unknown>);
}

export function makeMockImage() {
    return fluent({
        destroy: vi.fn(),
        setOrigin: vi.fn(),
        setDepth: vi.fn(),
        setPosition: vi.fn(),
        setTexture: vi.fn(),
        setScale: vi.fn(),
        texture: { key: '' },
        on: vi.fn(),
    } as Record<string, unknown>);
}

export function makeMockGraphics() {
    return fluent({
        destroy: vi.fn(),
        setDepth: vi.fn(),
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillRect: vi.fn(),
        fillTriangle: vi.fn(),
        fillPoints: vi.fn(),
        lineStyle: vi.fn(),
        strokeLineShape: vi.fn(),
        strokePoints: vi.fn(),
        lineBetween: vi.fn(),
        generateTexture: vi.fn(),
        on: vi.fn(),
    } as Record<string, unknown>);
}

export function makeMockCircleObj() {
    return fluent({
        destroy: vi.fn(),
        setDepth: vi.fn(),
        setStrokeStyle: vi.fn(),
        setInteractive: vi.fn(),
        setScale: vi.fn(),
        on: vi.fn(),
    } as Record<string, unknown>);
}

export function makeMockContainer() {
    return fluent({
        destroy: vi.fn(),
        setDepth: vi.fn(),
        setPosition: vi.fn(),
        setScale: vi.fn(),
        setInteractive: vi.fn(),
        add: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
    } as Record<string, unknown>);
}

export function makeMockSprite() {
    return fluent({
        destroy: vi.fn(),
        setPosition: vi.fn(),
        play: vi.fn(),
        setTint: vi.fn(),
        setFlipX: vi.fn(),
        setFlipY: vi.fn(),
        setVisible: vi.fn(),
        setScale: vi.fn(),
        setDepth: vi.fn(),
        setOrigin: vi.fn(),
        setInteractive: vi.fn(),
        setTexture: vi.fn(),
        depth: 0,
        x: 0,
        y: 0,
        texture: { key: '' },
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
    } as Record<string, unknown>);
}

export function makeMockKey() {
    return fluent({
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        destroy: vi.fn(),
    } as Record<string, unknown>);
}

export function makeMockCamera() {
    return fluent({
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
    } as Record<string, unknown>);
}

// ── Shared scene-props factory ─────────────────────────────────────────────
// Used by both makeMockScene() and MockScene constructor.
function makeMockSceneProps() {
    return {
        registry: {
            get: vi.fn().mockReturnValue(undefined),
            set: vi.fn(),
        },
        scale: {
            width: 800,
            height: 600,
            on: vi.fn(),
        },
        input: {
            keyboard: {
                on: vi.fn(),
                off: vi.fn(),
                addKey: vi.fn().mockImplementation(() => makeMockKey()),
                removeKey: vi.fn(),
            },
            setDefaultCursor: vi.fn(),
        },
        add: {
            text: vi.fn().mockImplementation(() => makeMockText()),
            rectangle: vi.fn().mockImplementation(() => makeMockRectangle()),
            image: vi.fn().mockImplementation(() => makeMockImage()),
            graphics: vi.fn().mockImplementation(() => makeMockGraphics()),
            circle: vi.fn().mockImplementation(() => makeMockCircleObj()),
            container: vi.fn().mockImplementation(() => makeMockContainer()),
            sprite: vi.fn().mockImplementation(() => makeMockSprite()),
        },
        time: {
            delayedCall: vi.fn(),
        },
        cameras: {
            main: makeMockCamera(),
        },
        textures: {
            exists: vi.fn().mockReturnValue(false),
            get: vi.fn().mockReturnValue({
                getSourceImage: vi
                    .fn()
                    .mockReturnValue({ width: 100, height: 100 }),
            }),
        },
        events: {
            once: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        },
        tweens: {
            add: vi.fn(),
        },
        // Phaser's scene plugin (this.scene.start() etc.)
        scene: {
            start: vi.fn(),
            stop: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            switch: vi.fn(),
        },
        // Phaser's loader plugin (this.load.image() etc.)
        load: {
            image: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        },
    };
}

/**
 * Creates a plain-object mock scene for tests that pass `Phaser.Scene` as a
 * parameter (ChoicePresenter, MenuOverlay, CompletionOverlay, etc.).
 *
 * Cast to `any` or `unknown as Phaser.Scene` when passing to constructors.
 */
export function makeMockScene() {
    return makeMockSceneProps();
}

// ── MockScene class ────────────────────────────────────────────────────────
// Must be a real class so `BaseScene extends Phaser.Scene` compiles and works.
// The constructor populates every instance with fresh vi.fn() mocks.
export class MockScene {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;

    constructor(_key?: string) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const key = _key;
        Object.assign(this, makeMockSceneProps());
    }
}

// ── Mock EventEmitter ──────────────────────────────────────────────────────
export class MockEventEmitter {
    on = vi.fn().mockReturnThis();
    off = vi.fn().mockReturnThis();
    once = vi.fn().mockReturnThis();
    emit = vi.fn().mockReturnThis();
    removeAllListeners = vi.fn();
}

// ── Phaser namespace ───────────────────────────────────────────────────────
const Phaser = {
    Scene: MockScene,

    GameObjects: {
        Text: class {},
        Rectangle: class {},
        Image: class {},
        Graphics: class {},
        Circle: class {},
        Container: class {},
        GameObject: class {},
        Sprite: class {},
    },

    Input: {
        Pointer: class {},
        Keyboard: {
            Key: class {
                on = vi.fn().mockReturnThis();
                off = vi.fn().mockReturnThis();
                once = vi.fn().mockReturnThis();
                destroy = vi.fn();
            },
            KeyCodes: {
                ESC: 27,
                ENTER: 13,
                BACKSPACE: 8,
                SPACE: 32,
            },
        },
    },

    Geom: {
        Line: class {
            constructor(
                public x1 = 0,
                public y1 = 0,
                public x2 = 0,
                public y2 = 0
            ) {}
        },
        Point: class {
            constructor(
                public x = 0,
                public y = 0
            ) {}
        },
        Circle: Object.assign(
            class {
                constructor(
                    public x = 0,
                    public y = 0,
                    public radius = 0
                ) {}
            },
            { Contains: vi.fn().mockReturnValue(true) }
        ),
    },

    Events: {
        EventEmitter: MockEventEmitter,
    },

    Types: {
        Input: {
            EventData: class {
                stopPropagation = vi.fn();
            },
        },
    },
};

export default Phaser;
