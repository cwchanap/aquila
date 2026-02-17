import Phaser from 'phaser';

export class CompletionOverlay {
    private scene: Phaser.Scene;
    private overlay?: Phaser.GameObjects.Rectangle;
    private titleText?: Phaser.GameObjects.Text;
    private tipText?: Phaser.GameObjects.Text;
    private btn?: Phaser.GameObjects.Text;
    private enterKeyListener?: Phaser.Input.Keyboard.Key;
    private _visible = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    get visible(): boolean {
        return this._visible;
    }

    show(locale: string): void {
        if (this._visible) return;
        this._visible = true;

        const isZh = (locale ?? '').startsWith('zh');
        const homeUrl = locale ? `/${locale}/` : '/';
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;

        this.overlay = this.scene.add
            .rectangle(0, 0, width, height, 0x000000, 0.5)
            .setOrigin(0)
            .setDepth(1000);

        const title = isZh ? '章節完成' : 'Chapter Complete';
        const tip = isZh ? '按 Enter 返回主選單' : 'Press Enter to go Home';
        const btnLabel = isZh ? '🏠 回首頁' : '🏠 Home';

        this.titleText = this.scene.add
            .text(width / 2, height / 2 - 20, title, {
                fontSize: '36px',
                color: '#ffffff',
            })
            .setOrigin(0.5)
            .setDepth(1001);

        this.tipText = this.scene.add
            .text(width / 2, height / 2 + 8, tip, {
                fontSize: '16px',
                color: '#e5e7eb',
            })
            .setOrigin(0.5)
            .setDepth(1001);

        this.btn = this.scene.add
            .text(width / 2, height / 2 + 50, btnLabel, {
                fontSize: '18px',
                color: '#ffffff',
                backgroundColor: '#00000080',
                padding: { left: 12, right: 12, top: 8, bottom: 8 },
            })
            .setOrigin(0.5)
            .setDepth(1001)
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => {
                window.location.href = homeUrl;
            });

        this.enterKeyListener = this.scene.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.ENTER
        );
        this.enterKeyListener?.once('down', () => {
            window.location.href = homeUrl;
        });
    }

    destroy(): void {
        this.enterKeyListener?.removeAllListeners();
        this.enterKeyListener?.destroy();
        this.enterKeyListener = undefined;
        this.overlay?.destroy();
        this.titleText?.destroy();
        this.tipText?.destroy();
        this.btn?.destroy();
        this.overlay = undefined;
        this.titleText = undefined;
        this.tipText = undefined;
        this.btn = undefined;
        this._visible = false;
    }
}
