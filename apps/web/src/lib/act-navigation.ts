import { getStoryFlow, type Translations } from '@aquila/stories';

export interface ActInfo {
    label: string;
    sceneId: string;
    sortKey: number;
    rawName: string;
}

export interface ChapterGroup {
    chapterNum: number;
    label: string;
    acts: ActInfo[];
}

export interface ChaptersResult {
    mode: 'chapters';
    chapters: ChapterGroup[];
}

export interface BranchesResult {
    mode: 'branches';
    acts: ActInfo[];
}

export type PanelData = ChaptersResult | BranchesResult;

type LooseFlow = { nodes: Array<{ kind: string; sceneId?: string }> };

export function extractChapterKey(sceneId: string): string | null {
    const match = sceneId.match(/^(ch\d+)_/);
    return match ? match[1] : null;
}

export function extractChapterNum(sceneId: string): number | null {
    const match = sceneId.match(/^ch(\d+)_/);
    return match ? parseInt(match[1], 10) : null;
}

export function extractActName(sceneId: string): string {
    const match = sceneId.match(/(?:^|_)(act\d+|actFinal|actEpilogue)/);
    return match ? match[1] : '';
}

export function actLabel(rawName: string, t: Translations): string {
    if (rawName === 'actFinal') return t.reader.actFinal;
    if (rawName === 'actEpilogue') return t.reader.actEpilogue;
    const numMatch = rawName.match(/act(\d+)/);
    if (numMatch) {
        return t.reader.actLabel.replace('{n}', numMatch[1]);
    }
    return rawName;
}

export function actSortKey(rawName: string): number {
    if (rawName === 'actFinal') return 9998;
    if (rawName === 'actEpilogue') return 9999;
    const numMatch = rawName.match(/act(\d+)/);
    return numMatch ? parseInt(numMatch[1], 10) : 0;
}

export function extractBranchPrefix(sceneId: string): string {
    const match = sceneId.match(/^(.*?)(?:act\d+|actFinal|actEpilogue)/);
    return match ? match[1] : '';
}

export function branchMatchScore(
    candidatePrefix: string,
    currentPrefix: string
): number {
    if (!candidatePrefix && !currentPrefix) return 0;
    const cParts = candidatePrefix.split('_').filter(Boolean);
    const curParts = currentPrefix.split('_').filter(Boolean);
    let score = 0;
    for (let i = 0; i < Math.min(cParts.length, curParts.length); i++) {
        if (cParts[i] === curParts[i]) score++;
        else break;
    }
    return score;
}

export function chapterLabel(num: number, t: Translations): string {
    return t.reader.chapterLabel.replace('{n}', String(num));
}

export function buildChapterData(
    storyId: string,
    sceneId: string,
    t: Translations
): PanelData {
    const flow = getStoryFlow(storyId);
    if (!flow) return { mode: 'branches', acts: [] };

    const hasChapters = flow.nodes.some(
        n => n.kind === 'scene' && /^ch\d+_/.test(n.sceneId)
    );

    if (hasChapters) {
        return buildChapters(flow, t);
    }

    return buildBranches(flow, sceneId, t);
}

function buildChapters(flow: LooseFlow, t: Translations): ChaptersResult {
    const chapters: Record<number, Record<string, string>> = {};

    for (const node of flow.nodes) {
        if (node.kind !== 'scene') continue;
        if (!node.sceneId) continue;
        const sceneId = node.sceneId;
        const actMatch = sceneId.match(/(?:^|_)(act\d+|actFinal|actEpilogue)/);
        if (!actMatch) continue;

        const actName = actMatch[1];
        const chNum = extractChapterNum(sceneId);
        if (chNum === null) continue;

        if (!chapters[chNum]) chapters[chNum] = {};
        if (!chapters[chNum][actName]) chapters[chNum][actName] = sceneId;
    }

    const sorted = Object.entries(chapters)
        .map(([num, actsMap]) => ({
            chapterNum: Number(num),
            label: chapterLabel(Number(num), t),
            acts: Object.entries(actsMap)
                .map(([rawName, sid]) => ({
                    label: actLabel(rawName, t),
                    sceneId: sid,
                    sortKey: actSortKey(rawName),
                    rawName,
                }))
                .sort((a, b) => a.sortKey - b.sortKey),
        }))
        .sort((a, b) => a.chapterNum - b.chapterNum);

    return { mode: 'chapters', chapters: sorted };
}

function buildBranches(
    flow: LooseFlow,
    sceneId: string,
    t: Translations
): BranchesResult {
    const actCandidates: Record<string, string[]> = {};

    for (const node of flow.nodes) {
        if (node.kind !== 'scene') continue;
        if (!node.sceneId) continue;
        const match = node.sceneId.match(
            /(?:^|_)(act\d+|actFinal|actEpilogue)/
        );
        if (!match) continue;
        const actName = match[1];
        if (!actCandidates[actName]) actCandidates[actName] = [];
        actCandidates[actName].push(node.sceneId);
    }

    const currentBranch = extractBranchPrefix(sceneId);
    const currentParts = currentBranch.split('_').filter(Boolean);

    function isOnBranch(candidatePrefix: string): boolean {
        if (!candidatePrefix && !currentBranch) return true;
        const candParts = candidatePrefix.split('_').filter(Boolean);
        const shorter =
            candParts.length <= currentParts.length ? candParts : currentParts;
        const longer =
            candParts.length <= currentParts.length ? currentParts : candParts;
        for (let i = 0; i < shorter.length; i++) {
            if (shorter[i] !== longer[i]) return false;
        }
        return true;
    }

    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain Map; this module is non-reactive.
    const actMap = new Map<string, string>();
    for (const [actName, candidates] of Object.entries(actCandidates)) {
        const onBranch = candidates.filter(c =>
            isOnBranch(extractBranchPrefix(c))
        );
        if (onBranch.length === 0) continue;
        let bestScene = onBranch[0];
        let bestScore = branchMatchScore(
            extractBranchPrefix(bestScene),
            currentBranch
        );
        for (let i = 1; i < onBranch.length; i++) {
            const score = branchMatchScore(
                extractBranchPrefix(onBranch[i]),
                currentBranch
            );
            if (score > bestScore) {
                bestScore = score;
                bestScene = onBranch[i];
            }
        }
        actMap.set(actName, bestScene);
    }

    const acts = Array.from(actMap.entries())
        .map(([rawName, sid]) => ({
            label: actLabel(rawName, t),
            sceneId: sid,
            sortKey: actSortKey(rawName),
            rawName,
        }))
        .sort((a, b) => a.sortKey - b.sortKey);

    return { mode: 'branches', acts };
}
