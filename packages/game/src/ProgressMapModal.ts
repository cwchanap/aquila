import Phaser from 'phaser';
import {
    StoryProgressionMap,
    type StoryProgressionMapConfig,
} from './StoryProgressionMap';

export interface ProgressMapModalConfig {
    mapConfig: StoryProgressionMapConfig;
    onClose?: () => void;
    onNodeSelected?: (nodeId: string) => void;
}

/**
 * Modal overlay that displays the story progression map.
 * Can be shown from the game menu to let players see their progress.
 */
export class ProgressMapModal {
    private scene: Phaser.Scene;
    private config: ProgressMapModalConfig;
    private backdrop?: Phaser.GameObjects.Rectangle;
    private panel?: Phaser.GameObjects.Rectangle;
    private titleText?: Phaser.GameObjects.Text;
    private closeButton?: Phaser.GameObjects.Text;
    private map?: StoryProgressionMap;
    private container: Phaser.GameObjects.Container;
    private visible = false;

    constructor(scene: Phaser.Scene, config: ProgressMapModalConfig) {
        this.scene = scene;
        this.config = config;
        this.container = scene.add.container(0, 0).setDepth(980);
    }

    public show(): void {
        if (this.visible) return;
        this.visible = true;

        // Pause the scene's ESC listener to prevent menu toggle conflicts
        if (
            'pauseEscListener' in this.scene &&
            typeof this.scene.pauseEscListener === 'function'
        ) {
            (this.scene as { pauseEscListener: () => void }).pauseEscListener();
        }

        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        const locale = (this.scene.registry.get('locale') as string) || 'en';
        const isZh = locale.startsWith('zh');

        // Backdrop
        this.backdrop = this.scene.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
            .setDepth(980)
            .setInteractive()
            .on('pointerup', () => this.close());

        // Panel
        const panelWidth = Math.min(width - 40, 900);
        const panelHeight = Math.min(height - 100, 600);
        this.panel = this.scene.add
            .rectangle(
                width / 2,
                height / 2,
                panelWidth,
                panelHeight,
                0x0f172a,
                0.95
            )
            .setStrokeStyle(2, 0xffffff, 0.3)
            .setDepth(981);

        // Prevent backdrop click from closing when clicking panel
        this.panel
            .setInteractive()
            .on(
                'pointerdown',
                (
                    _pointer: Phaser.Input.Pointer,
                    _localX: number,
                    _localY: number,
                    event: Phaser.Types.Input.EventData
                ) => {
                    event.stopPropagation();
                }
            )
            .on(
                'pointerup',
                (
                    _pointer: Phaser.Input.Pointer,
                    _localX: number,
                    _localY: number,
                    event: Phaser.Types.Input.EventData
                ) => {
                    event.stopPropagation();
                }
            );

        // Title
        const titleText = isZh ? '故事進度圖' : 'Story Progress Map';
        this.titleText = this.scene.add
            .text(width / 2, height / 2 - panelHeight / 2 + 40, titleText, {
                fontSize: '28px',
                color: '#ffffff',
                fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setDepth(982);

        // Close button
        const closeText = isZh ? '✕ 關閉' : '✕ Close';
        this.closeButton = this.scene.add
            .text(
                width / 2 + panelWidth / 2 - 20,
                height / 2 - panelHeight / 2 + 40,
                closeText,
                {
                    fontSize: '18px',
                    color: '#e5e7eb',
                }
            )
            .setOrigin(1, 0.5)
            .setDepth(982)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                this.closeButton?.setColor('#ffffff');
            })
            .on('pointerout', () => {
                this.closeButton?.setColor('#e5e7eb');
            })
            .on('pointerup', () => this.close());

        // Legend
        this.createLegend(width, height, panelWidth, panelHeight, isZh);

        // Story progression map
        const mapX = width / 2 - panelWidth / 2 + 30;
        const mapY = height / 2 - panelHeight / 2 + 100;
        const mapWidth = panelWidth - 60;
        const mapHeight = panelHeight - 180;

        const mapConfig: StoryProgressionMapConfig = {
            ...this.config.mapConfig,
            width: mapWidth,
            height: mapHeight,
        };

        this.map = new StoryProgressionMap(this.scene, mapConfig);
        const mapContainer = this.map.getContainer();
        mapContainer.setPosition(mapX, mapY);
        mapContainer.setDepth(982);

        // Handle node clicks
        this.map.on('nodeClicked', (...args: unknown[]) => {
            const data = args[0] as { nodeId: string };
            if (this.config.onNodeSelected) {
                this.config.onNodeSelected(data.nodeId);
            }
            this.close();
        });

        // Add keyboard listener
        const escListener = this.scene.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.ESC
        );
        escListener?.once('down', () => this.close());

        // Store reference for cleanup
        this.container.add([
            this.backdrop,
            this.panel,
            this.titleText,
            this.closeButton,
        ]);
    }

    private createLegend(
        screenWidth: number,
        screenHeight: number,
        panelWidth: number,
        panelHeight: number,
        isZh: boolean
    ): void {
        const legendY = screenHeight / 2 + panelHeight / 2 - 50;
        const legendStartX = screenWidth / 2 - panelWidth / 2 + 60;
        const spacing = 140;

        const legendItems = [
            {
                color: 0x4ade80,
                label: isZh ? '已完成' : 'Completed',
                shape: 'circle',
            },
            {
                color: 0x60a5fa,
                label: isZh ? '當前' : 'Current',
                shape: 'circle',
            },
            {
                color: 0x6b7280,
                label: isZh ? '未解鎖' : 'Locked',
                shape: 'circle',
            },
            {
                color: 0xfbbf24,
                label: isZh ? '選擇點' : 'Choice',
                shape: 'diamond',
            },
        ];

        legendItems.forEach((item, index) => {
            const x = legendStartX + index * spacing;

            // Shape
            if (item.shape === 'circle') {
                const circle = this.scene.add.circle(
                    x,
                    legendY,
                    10,
                    item.color,
                    1
                );
                circle.setStrokeStyle(1, 0xffffff, 0.5);
                circle.setDepth(982);
                this.container.add(circle);
            } else if (item.shape === 'diamond') {
                const diamond = this.scene.add.graphics();
                diamond.fillStyle(item.color, 1);
                diamond.lineStyle(1, 0xffffff, 0.5);
                const size = 14;
                diamond.fillPoints(
                    [
                        new Phaser.Geom.Point(x, legendY - size / 2),
                        new Phaser.Geom.Point(x + size / 2, legendY),
                        new Phaser.Geom.Point(x, legendY + size / 2),
                        new Phaser.Geom.Point(x - size / 2, legendY),
                    ],
                    true
                );
                diamond.strokePoints(
                    [
                        new Phaser.Geom.Point(x, legendY - size / 2),
                        new Phaser.Geom.Point(x + size / 2, legendY),
                        new Phaser.Geom.Point(x, legendY + size / 2),
                        new Phaser.Geom.Point(x - size / 2, legendY),
                    ],
                    true
                );
                diamond.setDepth(982);
                this.container.add(diamond);
            }

            // Label
            const label = this.scene.add
                .text(x + 20, legendY, item.label, {
                    fontSize: '14px',
                    color: '#e5e7eb',
                })
                .setOrigin(0, 0.5)
                .setDepth(982);
            this.container.add(label);
        });
    }

    private close(): void {
        if (!this.visible) return;
        this.visible = false;

        // Resume the scene's ESC listener
        if (
            'resumeEscListener' in this.scene &&
            typeof this.scene.resumeEscListener === 'function'
        ) {
            (
                this.scene as { resumeEscListener: () => void }
            ).resumeEscListener();
        }

        if (this.config.onClose) {
            this.config.onClose();
        }

        this.destroy();
    }

    public destroy(): void {
        this.backdrop?.destroy();
        this.panel?.destroy();
        this.titleText?.destroy();
        this.closeButton?.destroy();
        this.map?.destroy();
        this.container.destroy();
    }

    public isVisible(): boolean {
        return this.visible;
    }

    /**
     * Update the map with new progress
     */
    public updateProgress(
        currentNodeId: string,
        completedHistory: string[]
    ): void {
        if (this.map) {
            this.map.update(currentNodeId, completedHistory);
        }
    }
}
