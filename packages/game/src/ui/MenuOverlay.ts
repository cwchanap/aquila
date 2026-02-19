import Phaser from 'phaser';

export interface MenuOverlayConfig {
    locale: string;
    onResume: () => void;
    onProgressMap: () => void;
    onHome: () => void;
}

export class MenuOverlay {
    private scene: Phaser.Scene;
    private uiElements: Phaser.GameObjects.GameObject[] = [];
    private _open = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    get open(): boolean {
        return this._open;
    }

    show(config: MenuOverlayConfig): void {
        if (this._open) return;
        this._open = true;

        const { locale, onResume, onProgressMap, onHome } = config;
        const isZh = locale.startsWith('zh');
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;

        const backdrop = this.scene.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
            .setDepth(950)
            .setInteractive()
            .on('pointerup', () => this.close(onResume));

        const panelWidth = Math.min(width - 120, 420);

        const buttonDefs = [
            {
                label: isZh ? '繼續旅程' : 'Resume Story',
                handler: () => this.close(onResume),
            },
            {
                label: isZh ? '📍 進度地圖' : '📍 Progress Map',
                handler: () => this.close(onProgressMap),
            },
            {
                label: isZh ? '返回首頁' : 'Return Home',
                handler: () => this.close(onHome),
            },
        ];

        const buttonCount = buttonDefs.length;
        const buttonHeight = 44;
        const buttonSpacing = 60;
        const titleAreaHeight = 80;
        const bottomPadding = 40;
        const panelHeight =
            titleAreaHeight +
            buttonCount * buttonHeight +
            (buttonCount - 1) * buttonSpacing +
            bottomPadding;

        const menuBottomGap = Math.max(140, height * 0.22);
        const panelY = Math.min(
            height / 2,
            height - menuBottomGap - panelHeight / 2
        );

        const panel = this.scene.add
            .rectangle(
                width / 2,
                panelY,
                panelWidth,
                panelHeight,
                0x0f172a,
                0.92
            )
            .setStrokeStyle(2, 0xffffff, 0.3)
            .setDepth(951);

        const stopProp = (
            _pointer: Phaser.Input.Pointer,
            _localX: number,
            _localY: number,
            event: Phaser.Types.Input.EventData
        ) => {
            event.stopPropagation();
        };
        panel
            .setInteractive()
            .on('pointerdown', stopProp)
            .on('pointerup', stopProp);

        const title = this.scene.add
            .text(
                width / 2,
                panelY - panelHeight / 2 + 42,
                isZh ? '遊戲選單' : 'Game Menu',
                { fontSize: '26px', color: '#ffffff' }
            )
            .setOrigin(0.5)
            .setDepth(952);

        this.uiElements.push(backdrop, panel, title);

        const firstButtonY = panelY - panelHeight / 2 + titleAreaHeight;

        buttonDefs.forEach((def, index) => {
            const y =
                buttonCount === 1
                    ? panelY
                    : firstButtonY + index * (buttonHeight + buttonSpacing);
            const buttonBg = this.scene.add
                .rectangle(width / 2, y, panelWidth - 60, 44, 0x1e293b, 0.9)
                .setStrokeStyle(1, 0xffffff, 0.35)
                .setDepth(951)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', () => buttonBg.setFillStyle(0x334155, 0.95))
                .on('pointerout', () => buttonBg.setFillStyle(0x1e293b, 0.9))
                .on('pointerdown', stopProp)
                .on(
                    'pointerup',
                    (
                        _pointer: Phaser.Input.Pointer,
                        _localX: number,
                        _localY: number,
                        event: Phaser.Types.Input.EventData
                    ) => {
                        event.stopPropagation();
                        def.handler();
                    }
                );

            const text = this.scene.add
                .text(width / 2, y, def.label, {
                    fontSize: '20px',
                    color: '#e2e8f0',
                })
                .setOrigin(0.5)
                .setDepth(952);

            this.uiElements.push(buttonBg, text);
        });
    }

    close(onDone?: () => void): void {
        if (!this._open) return;
        this.uiElements.forEach(el => el.destroy());
        this.uiElements = [];
        this._open = false;
        onDone?.();
    }

    forceClose(): void {
        this.uiElements.forEach(el => el.destroy());
        this.uiElements = [];
        this._open = false;
    }
}
