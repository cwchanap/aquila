import Phaser from 'phaser';

export interface EscListenerHost {
    pauseEscListener(): void;
    resumeEscListener(): void;
}

export function isEscListenerHost(
    scene: Phaser.Scene
): scene is Phaser.Scene & EscListenerHost {
    return (
        'pauseEscListener' in scene &&
        typeof scene.pauseEscListener === 'function' &&
        'resumeEscListener' in scene &&
        typeof scene.resumeEscListener === 'function'
    );
}
