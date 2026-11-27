import { describe, expect, it } from 'vitest';
import {
    buildHistoryLines,
    sceneHistoryLines,
    updateReaderHistory,
    type ReaderHistory,
} from '../reader-history';
import { getTranslations } from '@aquila/stories/translations';

const position = (sceneId: string, lastIndex = 0, storyId = 'story') => ({
    storyId,
    sceneId,
    lastIndex,
    ready: true,
});

describe('session history', () => {
    it('appends exits chronologically, including revisits, without duplicate reruns', () => {
        let history: ReaderHistory = {
            storyId: '',
            current: null,
            segments: [],
        };
        for (const next of [
            position('act1', 2),
            position('act1', 3),
            position('act2', 1),
            position('act2', 1),
            position('act1', 0),
        ]) {
            history = updateReaderHistory(history, next);
        }
        expect(history.segments).toEqual([
            { sceneId: 'act1', lastIndex: 3 },
            { sceneId: 'act2', lastIndex: 1 },
        ]);
        expect(history.current).toEqual({ sceneId: 'act1', lastIndex: 0 });
    });

    it('keeps at most 50 exited visits', () => {
        let history: ReaderHistory = {
            storyId: '',
            current: null,
            segments: [],
        };
        for (let i = 0; i <= 52; i++)
            history = updateReaderHistory(history, position(`scene${i}`));
        expect(history.segments).toHaveLength(50);
        expect(history.segments[0].sceneId).toBe('scene2');
        expect(history.segments[49].sceneId).toBe('scene51');
    });

    it('ignores incomplete and loading positions, and resets on a story change', () => {
        let history: ReaderHistory = {
            storyId: '',
            current: null,
            segments: [],
        };
        history = updateReaderHistory(history, position('act1', 4));
        history = updateReaderHistory(history, {
            ...position('act2'),
            ready: false,
        });
        history = updateReaderHistory(history, position(''));
        history = updateReaderHistory(history, position('act2'));
        expect(history.segments).toEqual([{ sceneId: 'act1', lastIndex: 4 }]);
        history = updateReaderHistory(history, {
            ...position('', 0, 'new-story'),
            ready: false,
        });
        expect(history.segments).toEqual([]);
        expect(
            updateReaderHistory(history, position('new-act', 0, 'new-story'))
                .segments
        ).toEqual([]);
    });

    it('rebuilds visited lines from current payloads and drops missing scenes', () => {
        const segments = [
            { sceneId: 'act1', lastIndex: 0 },
            { sceneId: 'missing', lastIndex: 1 },
            { sceneId: 'act1', lastIndex: 1 },
        ];
        const getDialogue = (sceneId: string) =>
            sceneId === 'act1'
                ? [{ dialogue: 'first' }, { dialogue: 'second' }]
                : null;
        const translations = {
            act1: [{ dialogue: 'uno' }, { dialogue: 'dos' }],
        };
        const lines = buildHistoryLines(
            segments,
            getDialogue,
            translations,
            getTranslations('en')
        );
        expect(
            lines.map(line => [line.text, line.secondText, line.separator])
        ).toEqual([
            ['first', 'uno', 'Act 1'],
            ['first', 'uno', 'Act 1'],
            ['second', 'dos', undefined],
        ]);
        expect(
            buildHistoryLines(
                segments,
                getDialogue,
                undefined,
                getTranslations('en')
            )[0].secondText
        ).toBeUndefined();
        const chinese = buildHistoryLines(
            segments,
            sceneId => (sceneId === 'act1' ? [{ dialogue: '你好' }] : null),
            undefined,
            getTranslations('zh')
        );
        expect(chinese.map(line => line.text)).toEqual(['你好', '你好']);
    });

    it('records the scene and position of each line so history can replay its voice', () => {
        const t = getTranslations('en');
        const dialogue = [{ dialogue: 'first' }, { dialogue: 'second' }];
        const lines = buildHistoryLines(
            [
                { sceneId: 'act1', lastIndex: 1 },
                { sceneId: 'act2', lastIndex: 0 },
            ],
            () => dialogue,
            undefined,
            t
        );
        expect(lines.map(line => [line.sceneId, line.index])).toEqual([
            ['act1', 0],
            ['act1', 1],
            ['act2', 0],
        ]);
        // Without a scene id there is no position to replay.
        expect(
            sceneHistoryLines(dialogue, 1, t).every(
                line => line.sceneId === undefined && line.index === undefined
            )
        ).toBe(true);
    });

    it('includes chapter labels for chaptered scenes and omits headings for unpatterned ids', () => {
        const segments = [
            { sceneId: 'ch1_act1', lastIndex: 0 },
            { sceneId: 'ch10_act1', lastIndex: 0 },
            { sceneId: 'intro', lastIndex: 0 },
        ];
        const lines = buildHistoryLines(
            segments,
            sceneId => [{ dialogue: sceneId }],
            undefined,
            getTranslations('en')
        );
        expect(lines.map(line => line.separator)).toEqual([
            'Chapter 1 · Act 1',
            'Chapter 10 · Act 1',
            undefined,
        ]);
    });
});
