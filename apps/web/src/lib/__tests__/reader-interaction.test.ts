import { describe, expect, it } from 'vitest';
import {
    getReaderAdvanceDecision,
    isReaderInteractiveTarget,
    isReaderProgressionTarget,
} from '@/lib/reader-interaction';

describe('getReaderAdvanceDecision', () => {
    it.each([
        [
            {
                isTyping: true,
                index: 0,
                length: 2,
                canGoNext: true,
                hasChoice: false,
            },
            'skip',
        ],
        [
            {
                isTyping: false,
                index: 0,
                length: 2,
                canGoNext: true,
                hasChoice: false,
            },
            'advance-line',
        ],
        [
            {
                isTyping: false,
                index: 1,
                length: 2,
                canGoNext: true,
                hasChoice: false,
            },
            'advance-scene',
        ],
        [
            {
                isTyping: false,
                index: 1,
                length: 2,
                canGoNext: true,
                hasChoice: true,
            },
            'none',
        ],
    ] as const)('returns %s', (input, expected) => {
        expect(getReaderAdvanceDecision(input)).toBe(expected);
    });
});

describe('isReaderInteractiveTarget', () => {
    it('recognizes controls, editable content, and marked descendants', () => {
        const root = document.createElement('div');
        const button = document.createElement('button');
        const buttonChild = document.createElement('span');
        button.append(buttonChild);
        const editor = document.createElement('div');
        editor.contentEditable = 'true';
        const marked = document.createElement('div');
        marked.dataset.readerInteractive = '';
        const markedChild = document.createElement('span');
        marked.append(markedChild);
        root.append(button, editor, marked);
        expect(isReaderInteractiveTarget(buttonChild)).toBe(true);
        expect(isReaderInteractiveTarget(editor)).toBe(true);
        expect(isReaderInteractiveTarget(markedChild)).toBe(true);
        expect(isReaderInteractiveTarget(root)).toBe(false);
    });
});

describe('isReaderProgressionTarget', () => {
    it('recognizes marked progression controls and their descendants', () => {
        const button = document.createElement('button');
        button.dataset.readerProgression = '';
        const child = document.createElement('span');
        button.append(child);
        expect(isReaderProgressionTarget(button)).toBe(true);
        expect(isReaderProgressionTarget(child)).toBe(true);
    });

    it('returns false for non-progression interactive elements', () => {
        const button = document.createElement('button');
        const marked = document.createElement('div');
        marked.dataset.readerInteractive = '';
        expect(isReaderProgressionTarget(button)).toBe(false);
        expect(isReaderProgressionTarget(marked)).toBe(false);
    });
});
