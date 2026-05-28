/** 'branch_1b/branch_2c' + 'act14' -> 'b1b_b2c_act14'; '' + 'act1' -> 'act1'. */
export function makeSceneId(dirRel: string, act: string): string {
    const branchParts = dirRel
        ? dirRel.split('/').map(s => s.replace(/^branch_/, 'b'))
        : [];
    return [...branchParts, act].join('_');
}

/** 'branch_1b/branch_2c' -> 'b2c' (option id from the child's own last segment). */
export function optionIdFromDirRel(dirRel: string): string {
    const last = dirRel.split('/').pop() ?? '';
    return last.replace(/^branch_/, 'b');
}

/** Sort key: numeric actN ascending, then actFinal, then actEpilogue. */
export function actSortKey(actBasename: string): number {
    if (actBasename === 'actFinal') return 1_000_000;
    if (actBasename === 'actEpilogue') return 1_000_001;
    const m = /^act(\d+)$/.exec(actBasename);
    if (!m) {
        throw new Error(
            `[story-compiler] unexpected act file name: ${actBasename}`
        );
    }
    return parseInt(m[1], 10);
}
