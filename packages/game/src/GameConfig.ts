/**
 * Centralized game configuration constants.
 * Replace magic numbers throughout the codebase with these named values.
 */
export const GameConfig = {
    ui: {
        /** Height of the dialogue box in pixels */
        dialogueBoxHeight: 180,
        /** Padding inside UI elements */
        dialoguePadding: 24,
        /** Margin from bottom of screen for dialogue box */
        dialogueBottomMargin: 20,
        /** Fade-in duration for scene transitions in ms */
        fadeInDuration: 350,
        /** Fade-out duration for scene transitions in ms */
        fadeOutDuration: 300,
    },
    audio: {
        /** Default ambient oscillator gain (very quiet) */
        defaultAmbientGain: 0.004,
        /** Default ambient frequency in Hz */
        defaultAmbientFrequency: 80,
        /** Beep sound gain for dialogue advance */
        beepGain: 0.02,
        /** Beep sound frequency in Hz */
        beepFrequency: 880,
        /** Beep sound duration in seconds */
        beepDuration: 0.05,
    },
} as const;

export type GameConfigType = typeof GameConfig;
