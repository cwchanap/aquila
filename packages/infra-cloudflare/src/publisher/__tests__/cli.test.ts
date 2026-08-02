import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PublisherError } from '../errors';
import type { PublisherReportV1 } from '../report';
import type { DeliveryStore } from '../stores/delivery-store';
import {
    buildReleaseListReport,
    mergePublicationWithReactivation,
    runAssetsCli,
    type AssetsCliDependencies,
    type ParsedAssetsCommand,
} from '../cli';

function report(
    command: PublisherReportV1['command'],
    status: PublisherReportV1['status'] = 'success'
): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command,
        status,
        storyId: 'example_story',
        target: { kind: 'production' },
        counts: {
            included: 0,
            omitted: 0,
            objectsCreated: 0,
            objectsReused: 0,
            manifestsCreated: 0,
            manifestsReused: 0,
            pointersWritten: 0,
        },
        actions: [],
        warnings: [],
        errors: [],
    };
}

function fakeStore(close = vi.fn(async () => undefined)): DeliveryStore {
    return {
        stat: vi.fn(async () => null),
        read: vi.fn(async () => {
            throw new Error('unused');
        }),
        createImmutable: vi.fn(async () => ({ status: 'created' as const })),
        inspectPointer: vi.fn(async () => ({ exists: false as const })),
        readPointer: vi.fn(async () => ({ exists: false as const })),
        compareAndSwapPointer: vi.fn(async () => ({
            status: 'written' as const,
        })),
        async *listKeys() {},
        async *list() {},
        close,
    };
}

function harness(
    run: AssetsCliDependencies['runCommand'] = vi.fn(async command =>
        report(command.command)
    )
): {
    dependencies: AssetsCliDependencies;
    stdout: () => string;
    stderr: () => string;
    localFactory: ReturnType<typeof vi.fn>;
    r2Factory: ReturnType<typeof vi.fn>;
    localStore: DeliveryStore;
    r2Store: DeliveryStore;
} {
    let stdout = '';
    let stderr = '';
    const localStore = fakeStore();
    const r2Store = fakeStore();
    const localFactory = vi.fn(async () => localStore);
    const r2Factory = vi.fn(async () => r2Store);
    return {
        dependencies: {
            repositoryRoot: '/workspace/aquila',
            environment: {
                R2_PUBLISHER_ACCESS_KEY_ID: 'publisher-access',
                R2_PUBLISHER_SECRET_ACCESS_KEY: 'publisher-secret',
            },
            createLocalStore: localFactory,
            createR2Store: r2Factory,
            runCommand: run,
            stdout: {
                write(chunk) {
                    stdout += String(chunk);
                    return true;
                },
            },
            stderr: {
                write(chunk) {
                    stderr += String(chunk);
                    return true;
                },
            },
        },
        stdout: () => stdout,
        stderr: () => stderr,
        localFactory,
        r2Factory,
        localStore,
        r2Store,
    };
}

const localPlan = [
    'plan',
    '--story',
    'example_story',
    '--environment',
    'preview',
    '--preview-id',
    'gate-123',
    '--destination-root',
    '/tmp/aquila-delivery',
];

describe('assets CLI destination selection and safety', () => {
    it('defaults an omitted destination to the explicit local root', async () => {
        const runCommand = vi.fn(async command => report(command.command));
        const test = harness(runCommand);

        await expect(runAssetsCli(localPlan, test.dependencies)).resolves.toBe(
            0
        );

        expect(test.localFactory).toHaveBeenCalledWith('/tmp/aquila-delivery');
        expect(test.r2Factory).not.toHaveBeenCalled();
        expect(runCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                command: 'plan',
                storyId: 'example_story',
                target: { kind: 'preview', previewId: 'gate-123' },
                destination: {
                    kind: 'local',
                    root: '/tmp/aquila-delivery',
                },
                store: test.localStore,
            })
        );
    });

    it('rejects local without a root before constructing a store', async () => {
        const test = harness();

        await expect(
            runAssetsCli(
                [
                    'releases',
                    '--story',
                    'example_story',
                    '--environment',
                    'production',
                ],
                test.dependencies
            )
        ).resolves.toBe(1);

        expect(test.localFactory).not.toHaveBeenCalled();
        expect(test.r2Factory).not.toHaveBeenCalled();
    });

    it('rejects a destination root for R2 before constructing either store', async () => {
        const test = harness();

        await expect(
            runAssetsCli(
                [
                    'releases',
                    '--story',
                    'example_story',
                    '--environment',
                    'production',
                    '--destination',
                    'r2',
                    '--destination-root',
                    '/tmp/must-not-be-used',
                ],
                test.dependencies
            )
        ).resolves.toBe(1);

        expect(test.localFactory).not.toHaveBeenCalled();
        expect(test.r2Factory).not.toHaveBeenCalled();
    });

    it('rejects incomplete R2 credentials without constructing a local store', async () => {
        const test = harness();
        test.dependencies.environment = {
            R2_PUBLISHER_ACCESS_KEY_ID: 'publisher-access',
        };

        await expect(
            runAssetsCli(
                [
                    'verify',
                    '--story',
                    'example_story',
                    '--environment',
                    'production',
                    '--release',
                    `sha256-${'a'.repeat(64)}`,
                    '--destination',
                    'r2',
                ],
                test.dependencies
            )
        ).resolves.toBe(1);

        expect(test.localFactory).not.toHaveBeenCalled();
        expect(test.r2Factory).not.toHaveBeenCalled();
    });

    it.each([
        ['/workspace/aquila/sources', '/workspace/aquila/sources/output'],
        ['/workspace/aquila/sources/output', '/workspace/aquila/sources'],
    ])(
        'rejects overlapping source %s and destination %s before mutation',
        async (sourceRoot, destinationRoot) => {
            const runCommand = vi.fn(async command => report(command.command));
            const test = harness(runCommand);

            await expect(
                runAssetsCli(
                    [
                        ...localPlan,
                        '--source-root',
                        sourceRoot,
                        '--destination-root',
                        destinationRoot,
                    ],
                    test.dependencies
                )
            ).resolves.toBe(1);

            expect(runCommand).not.toHaveBeenCalled();
            expect(test.localFactory).not.toHaveBeenCalled();
        }
    );

    it('protects the default source root when --source-root is omitted', async () => {
        const test = harness();

        const exit = await runAssetsCli(
            localPlan.map(value =>
                value === '/tmp/aquila-delivery'
                    ? 'packages/assets/media/output'
                    : value
            ),
            test.dependencies
        );

        expect(exit).toBe(1);
        expect(test.localFactory).not.toHaveBeenCalled();
    });

    it('resolves relative --source-root and --plan against repositoryRoot, not cwd', async () => {
        // Safety validation resolves relative paths against repositoryRoot, but
        // the source/plan loaders previously resolved the same values against
        // process.cwd(). Running the CLI outside the repository root would
        // then validate one filesystem location and read another, bypassing
        // the source/destination overlap guard. Both paths must now resolve
        // against repositoryRoot once and flow through to execution.
        const root = await mkdtemp(join(tmpdir(), 'aquila-cli-cwd-'));
        const originalCwd = process.cwd();
        try {
            const repositoryRoot = join(root, 'repo');
            const sourceRoot = join(repositoryRoot, 'sources');
            const destinationRoot = join(root, 'destination');
            const planFile = join(repositoryRoot, 'plan.json');
            await mkdir(repositoryRoot, { recursive: true });
            await Promise.all([
                mkdir(sourceRoot, { recursive: true }),
                mkdir(destinationRoot, { recursive: true }),
                writeFile(planFile, '{}'),
            ]);
            // Run from a cwd that is neither the repository root nor a
            // directory containing `sources` or `plan.json`, so a cwd-relative
            // resolution would point at non-existent paths.
            const elsewhere = join(root, 'elsewhere');
            await mkdir(elsewhere, { recursive: true });
            process.chdir(elsewhere);

            const runCommand = vi.fn(async command => report(command.command));
            const test = harness(runCommand);
            test.dependencies.repositoryRoot = repositoryRoot;

            const exit = await runAssetsCli(
                [
                    'plan',
                    '--story',
                    'example_story',
                    '--environment',
                    'preview',
                    '--preview-id',
                    'gate-123',
                    '--source-root',
                    'sources',
                    '--plan',
                    'plan.json',
                    '--destination-root',
                    destinationRoot,
                ],
                test.dependencies
            );

            expect(exit).toBe(0);
            expect(runCommand).toHaveBeenCalledTimes(1);
            const passed = runCommand.mock.calls[0][0] as ParsedAssetsCommand;
            expect(passed.sourceRoot).toBe(sourceRoot);
            expect(passed.releasePlanPath).toBe(planFile);
        } finally {
            process.chdir(originalCwd);
            await rm(root, { recursive: true, force: true });
        }
    });

    it.each(['destination-alias', 'source-alias', 'plan-alias'] as const)(
        'rejects canonical overlap through a %s before store construction',
        async aliasKind => {
            const root = await mkdtemp(join(tmpdir(), 'aquila-cli-safety-'));
            try {
                const repositoryRoot = join(root, 'repo');
                const sourceRoot = join(repositoryRoot, 'source');
                const destinationRoot = join(repositoryRoot, 'destination');
                await Promise.all([
                    mkdir(sourceRoot, { recursive: true }),
                    mkdir(destinationRoot, { recursive: true }),
                ]);
                const test = harness();
                test.dependencies.repositoryRoot = repositoryRoot;
                let selectedSource = sourceRoot;
                let selectedDestination = destinationRoot;
                let planArgs: string[] = [];

                if (aliasKind === 'destination-alias') {
                    selectedDestination = join(repositoryRoot, 'delivery-link');
                    await symlink(sourceRoot, selectedDestination);
                } else if (aliasKind === 'source-alias') {
                    selectedSource = join(repositoryRoot, 'source-link');
                    await symlink(destinationRoot, selectedSource);
                } else {
                    const planInsideDestination = join(
                        destinationRoot,
                        'release-plan.json'
                    );
                    const planAlias = join(repositoryRoot, 'plan-link.json');
                    await writeFile(planInsideDestination, '{}');
                    await symlink(planInsideDestination, planAlias);
                    planArgs = ['--plan', planAlias];
                }

                const exit = await runAssetsCli(
                    [
                        'plan',
                        '--story',
                        'example_story',
                        '--environment',
                        'preview',
                        '--preview-id',
                        'gate-123',
                        '--source-root',
                        selectedSource,
                        '--destination-root',
                        selectedDestination,
                        ...planArgs,
                    ],
                    test.dependencies
                );

                expect(exit).toBe(1);
                expect(test.localFactory).not.toHaveBeenCalled();
                expect(test.r2Factory).not.toHaveBeenCalled();
                expect(test.dependencies.runCommand).not.toHaveBeenCalled();
            } finally {
                await rm(root, { recursive: true, force: true });
            }
        }
    );

    it('rejects a destination that contains the repository root', async () => {
        const test = harness();

        await expect(
            runAssetsCli(
                localPlan.map(value =>
                    value === '/tmp/aquila-delivery' ? '/workspace' : value
                ),
                test.dependencies
            )
        ).resolves.toBe(1);

        expect(test.localFactory).not.toHaveBeenCalled();
    });
});

describe('assets CLI command schemas and confirmation matrix', () => {
    it.each([
        ['plan', ['--plan', '/tmp/plan.json', '--source-root', '/tmp/source']],
        [
            'publish',
            [
                '--plan',
                '/tmp/plan.json',
                '--source-root',
                '/tmp/source',
                '--no-activate',
            ],
        ],
    ] as const)('accepts source inputs for %s', async (command, extra) => {
        const runCommand = vi.fn(async parsed => report(parsed.command));
        const test = harness(runCommand);

        const exit = await runAssetsCli(
            [
                command,
                '--story',
                'example_story',
                '--environment',
                'production',
                '--destination-root',
                '/tmp/aquila-delivery',
                ...extra,
            ],
            test.dependencies
        );

        expect(exit).toBe(0);
        expect(runCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                releasePlanPath: '/tmp/plan.json',
                sourceRoot: '/tmp/source',
            })
        );
    });

    it.each(['activate', 'verify', 'releases', 'rollback', 'mirror-preview'])(
        'rejects source flags for %s before dispatch',
        async command => {
            const runCommand = vi.fn(async parsed => report(parsed.command));
            const test = harness(runCommand);
            const targetArgs =
                command === 'mirror-preview'
                    ? ['--preview-id', 'gate-123']
                    : ['--environment', 'production'];
            const releaseArgs =
                command === 'releases'
                    ? []
                    : ['--release', `sha256-${'a'.repeat(64)}`];

            const exit = await runAssetsCli(
                [
                    command,
                    '--story',
                    'example_story',
                    ...targetArgs,
                    ...releaseArgs,
                    '--destination-root',
                    '/tmp/aquila-delivery',
                    '--source-root',
                    '/tmp/source',
                ],
                test.dependencies
            );

            expect(exit).toBe(1);
            expect(runCommand).not.toHaveBeenCalled();
        }
    );

    it.each([
        ['--no-activate', '--reactivate'],
        ['--no-activate', '--override-concurrent-pointer'],
    ])('rejects incompatible publish flags %s %s', async (...flags) => {
        const runCommand = vi.fn(async parsed => report(parsed.command));
        const test = harness(runCommand);

        const exit = await runAssetsCli(
            [
                'publish',
                '--story',
                'example_story',
                '--environment',
                'production',
                '--destination-root',
                '/tmp/aquila-delivery',
                ...flags,
            ],
            test.dependencies
        );

        expect(exit).toBe(1);
        expect(runCommand).not.toHaveBeenCalled();
    });

    it.each(['plan', 'publish', 'activate', 'verify', 'releases', 'rollback'])(
        'requires a preview id for preview %s',
        async command => {
            const test = harness();
            const releaseArgs =
                command === 'activate' ||
                command === 'verify' ||
                command === 'rollback'
                    ? ['--release', `sha256-${'a'.repeat(64)}`]
                    : [];
            const extra = command === 'publish' ? ['--no-activate'] : [];

            await expect(
                runAssetsCli(
                    [
                        command,
                        '--story',
                        'example_story',
                        '--environment',
                        'preview',
                        ...releaseArgs,
                        ...extra,
                        '--destination-root',
                        '/tmp/aquila-delivery',
                    ],
                    test.dependencies
                )
            ).resolves.toBe(1);
        }
    );

    it('requires an exact preview id for mirror-preview', async () => {
        const test = harness();

        await expect(
            runAssetsCli(
                [
                    'mirror-preview',
                    '--story',
                    'example_story',
                    '--release',
                    `sha256-${'a'.repeat(64)}`,
                    '--destination-root',
                    '/tmp/aquila-delivery',
                ],
                test.dependencies
            )
        ).resolves.toBe(1);
    });

    it.each(['mirror-preview', 'activate', 'verify', 'rollback'])(
        'requires a release id for %s before store construction',
        async command => {
            const test = harness();
            const targetArgs =
                command === 'mirror-preview'
                    ? ['--preview-id', 'gate-123']
                    : ['--environment', 'preview', '--preview-id', 'gate-123'];

            const exit = await runAssetsCli(
                [
                    command,
                    '--story',
                    'example_story',
                    ...targetArgs,
                    '--destination-root',
                    '/tmp/aquila-delivery',
                ],
                test.dependencies
            );

            expect(exit).toBe(1);
            expect(test.localFactory).not.toHaveBeenCalled();
        }
    );

    it.each([
        ['activate', 5],
        ['rollback', 5],
        ['verify', 2],
        ['mirror-preview', 2],
    ] as const)(
        'maps malformed %s release syntax to exit %d before store construction',
        async (command, expectedExit) => {
            const test = harness();
            const targetArgs =
                command === 'mirror-preview'
                    ? ['--preview-id', 'gate-123']
                    : ['--environment', 'preview', '--preview-id', 'gate-123'];

            const exit = await runAssetsCli(
                [
                    command,
                    '--story',
                    'example_story',
                    ...targetArgs,
                    '--release',
                    'not-a-release',
                    '--destination-root',
                    '/tmp/aquila-delivery',
                    '--json',
                ],
                test.dependencies
            );

            expect(exit).toBe(expectedExit);
            expect(() => JSON.parse(test.stdout())).not.toThrow();
            expect(test.localFactory).not.toHaveBeenCalled();
            expect(test.dependencies.runCommand).not.toHaveBeenCalled();
        }
    );

    it('passes standalone publish reactivation through the parsed contract', async () => {
        const runCommand = vi.fn(async parsed => report(parsed.command));
        const test = harness(runCommand);

        const exit = await runAssetsCli(
            [
                'publish',
                '--story',
                'example_story',
                '--environment',
                'preview',
                '--preview-id',
                'gate-123',
                '--reactivate',
                '--destination-root',
                '/tmp/aquila-delivery',
            ],
            test.dependencies
        );

        expect(exit).toBe(0);
        expect(runCommand).toHaveBeenCalledWith(
            expect.objectContaining({ reactivate: true })
        );
    });

    it.each([
        ['publish', ['--environment', 'production']],
        [
            'activate',
            [
                '--environment',
                'production',
                '--release',
                `sha256-${'a'.repeat(64)}`,
            ],
        ],
        [
            'rollback',
            [
                '--environment',
                'production',
                '--release',
                `sha256-${'a'.repeat(64)}`,
            ],
        ],
    ] as const)(
        'rejects production pointer mutation by %s without exact confirmation',
        async (command, commandArgs) => {
            const runCommand = vi.fn(async parsed => report(parsed.command));
            const test = harness(runCommand);

            for (const confirmation of [undefined, 'wrong_story']) {
                const exit = await runAssetsCli(
                    [
                        command,
                        '--story',
                        'example_story',
                        ...commandArgs,
                        '--destination-root',
                        '/tmp/aquila-delivery',
                        ...(confirmation === undefined
                            ? []
                            : ['--confirm-production', confirmation]),
                    ],
                    test.dependencies
                );
                expect(exit).toBe(5);
            }
            expect(runCommand).not.toHaveBeenCalled();
        }
    );

    it.each([
        ['publish', ['--environment', 'production', '--no-activate']],
        [
            'mirror-preview',
            [
                '--release',
                `sha256-${'a'.repeat(64)}`,
                '--preview-id',
                'gate-123',
            ],
        ],
        [
            'verify',
            [
                '--environment',
                'production',
                '--release',
                `sha256-${'a'.repeat(64)}`,
            ],
        ],
        ['releases', ['--environment', 'production']],
    ] as const)(
        'allows production-safe %s without confirmation',
        async (command, commandArgs) => {
            const runCommand = vi.fn(async parsed => report(parsed.command));
            const test = harness(runCommand);

            await expect(
                runAssetsCli(
                    [
                        command,
                        '--story',
                        'example_story',
                        ...commandArgs,
                        '--destination-root',
                        '/tmp/aquila-delivery',
                    ],
                    test.dependencies
                )
            ).resolves.toBe(0);
            expect(runCommand).toHaveBeenCalledOnce();
        }
    );

    it('rejects unknown commands, unknown options, and positionals', async () => {
        for (const args of [
            ['destroy', '--story', 'example_story'],
            [...localPlan, '--unknown-option'],
            [...localPlan, 'unexpected-positional'],
        ]) {
            const test = harness();
            await expect(runAssetsCli(args, test.dependencies)).resolves.toBe(
                1
            );
            expect(test.localFactory).not.toHaveBeenCalled();
            expect(test.r2Factory).not.toHaveBeenCalled();
        }
    });
});

describe('assets CLI dispatch, lifecycle, output, and exits', () => {
    it.each([
        'plan',
        'publish',
        'mirror-preview',
        'activate',
        'verify',
        'releases',
        'rollback',
    ] as const)('dispatches exactly the selected %s command', async command => {
        const seen: ParsedAssetsCommand[] = [];
        const test = harness(async parsed => {
            seen.push(parsed);
            return report(parsed.command);
        });
        const targetArgs =
            command === 'mirror-preview'
                ? ['--preview-id', 'gate-123']
                : ['--environment', 'preview', '--preview-id', 'gate-123'];
        const releaseArgs =
            command === 'releases' ||
            command === 'plan' ||
            command === 'publish'
                ? []
                : ['--release', `sha256-${'a'.repeat(64)}`];
        const publishArgs = command === 'publish' ? ['--no-activate'] : [];

        const exit = await runAssetsCli(
            [
                command,
                '--story',
                'example_story',
                ...targetArgs,
                ...releaseArgs,
                ...publishArgs,
                '--destination-root',
                '/tmp/aquila-delivery',
            ],
            test.dependencies
        );

        expect(exit).toBe(0);
        expect(seen.map(item => item.command)).toEqual([command]);
    });

    it.each(['success', 'failure'] as const)(
        'closes only the selected store after %s',
        async outcome => {
            const close = vi.fn(async () => undefined);
            const store = fakeStore(close);
            const test = harness(
                outcome === 'success'
                    ? async parsed => report(parsed.command)
                    : async () => {
                          throw new PublisherError(
                              'storage',
                              'sanitized store failure'
                          );
                      }
            );
            test.dependencies.createLocalStore = vi.fn(async () => store);

            await runAssetsCli(localPlan, test.dependencies);

            expect(close).toHaveBeenCalledOnce();
            expect(test.r2Factory).not.toHaveBeenCalled();
        }
    );

    it('maps a selected-store close failure without emitting a second JSON document', async () => {
        const test = harness();
        test.dependencies.createLocalStore = vi.fn(async () =>
            fakeStore(
                vi.fn(async () => {
                    throw new Error(
                        'secret close failure /Users/alice/private/output'
                    );
                })
            )
        );

        const exit = await runAssetsCli(
            [...localPlan, '--json'],
            test.dependencies
        );

        expect(exit).toBe(3);
        expect(() => JSON.parse(test.stdout())).not.toThrow();
        expect(test.stdout().trim().split('\n')).toHaveLength(1);
        expect(`${test.stdout()}${test.stderr()}`).not.toContain(
            'secret close failure'
        );
        expect(`${test.stdout()}${test.stderr()}`).not.toContain('/Users/');
    });

    it.each(['missing', 'malformed'])(
        'maps %s R2 config creation failures to sanitized exit 1',
        async failureKind => {
            const privatePath = `/Users/alice/private/${failureKind}.json`;
            const rawSecret = `raw-${failureKind}-secret`;
            const runCommand = vi.fn(async parsed => report(parsed.command));
            const test = harness(runCommand);
            test.dependencies.createR2Store = vi.fn(async () => {
                throw new PublisherError(
                    'configuration',
                    `Unable to load ${privatePath}: ${rawSecret}`
                );
            });

            const exit = await runAssetsCli(
                [
                    'releases',
                    '--story',
                    'example_story',
                    '--environment',
                    'production',
                    '--destination',
                    'r2',
                    '--json',
                ],
                test.dependencies
            );

            expect(exit).toBe(1);
            expect(test.localFactory).not.toHaveBeenCalled();
            expect(runCommand).not.toHaveBeenCalled();
            expect(`${test.stdout()}${test.stderr()}`).not.toContain(
                privatePath
            );
            expect(`${test.stdout()}${test.stderr()}`).not.toContain(rawSecret);
        }
    );

    it('emits one JSON document to stdout and progress only to stderr', async () => {
        const test = harness(async parsed => {
            parsed.progress?.({
                stage: 'encode',
                completed: 1,
                total: 1,
                message:
                    'Authorization: Bearer progress-secret /Users/alice/private.png',
            });
            return report(parsed.command, 'no-op');
        });

        const exit = await runAssetsCli(
            [...localPlan, '--json'],
            test.dependencies
        );

        expect(exit).toBe(0);
        expect(() => JSON.parse(test.stdout())).not.toThrow();
        expect(test.stdout().trim().split('\n')).toHaveLength(1);
        expect(test.stderr()).toBe('encode 1/1\n');
        expect(test.stdout()).not.toContain('progress-secret');
        expect(test.stderr()).not.toContain('progress-secret');
        expect(test.stdout()).not.toContain('/Users/');
        expect(test.stderr()).not.toContain('/Users/');
    });

    it.each([
        ['no-op', 0],
        ['conflict', 4],
    ] as const)(
        'maps report status %s to exit %d',
        async (status, expected) => {
            const test = harness(async parsed =>
                report(parsed.command, status)
            );

            await expect(
                runAssetsCli([...localPlan, '--json'], test.dependencies)
            ).resolves.toBe(expected);
        }
    );

    it.each([
        ['concurrency', 4],
        ['activation-target', 5],
        ['clock-skew', 5],
        ['configuration', 1],
        ['coverage', 2],
        ['encoding', 2],
        ['source', 2],
        ['integrity', 2],
        ['storage', 3],
    ] as const)('maps thrown %s errors to exit %d', async (code, expected) => {
        const secret = 'publisher-secret-never-print';
        const test = harness(async () => {
            throw new PublisherError(
                code,
                `unsafe ${secret} /Users/alice/private/source.png`,
                {
                    context: {
                        path: '/Users/alice/private/source.png',
                        secret,
                    },
                }
            );
        });

        const exit = await runAssetsCli(
            [...localPlan, '--json'],
            test.dependencies
        );

        expect(exit).toBe(expected);
        expect(() => JSON.parse(test.stdout())).not.toThrow();
        expect(test.stdout().trim().split('\n')).toHaveLength(1);
        expect(`${test.stdout()}${test.stderr()}`).not.toContain(secret);
        expect(`${test.stdout()}${test.stderr()}`).not.toContain('/Users/');
    });

    it('reports safe clock-skew timestamps without leaking error context', async () => {
        const previousPublishedAt = '2026-08-01T12:00:00.000Z';
        const localNow = '2026-08-01T11:00:00.000Z';
        const secret = 'clock-skew-secret-never-print';
        const test = harness(async () => {
            throw new PublisherError(
                'clock-skew',
                `unsafe ${secret} /Users/alice/private/source.png`,
                {
                    context: {
                        previousPublishedAt,
                        localNow,
                        path: '/Users/alice/private/source.png',
                        secret,
                    },
                }
            );
        });

        const exit = await runAssetsCli(
            [...localPlan, '--json'],
            test.dependencies
        );
        const output = JSON.parse(test.stdout()) as PublisherReportV1;

        expect(exit).toBe(5);
        expect(output.errors).toEqual([
            expect.objectContaining({
                code: 'clock-skew',
                previousPublishedAt,
                localNow,
            }),
        ]);
        expect(`${test.stdout()}${test.stderr()}`).not.toContain(secret);
        expect(`${test.stdout()}${test.stderr()}`).not.toContain('/Users/');
    });

    it('preserves the failed stage from PublisherError context in the report', async () => {
        const test = harness(async () => {
            throw new PublisherError('storage', 'upload failed', {
                context: { stage: 'upload', key: 'vn/objects/abc.webp' },
            });
        });

        const exit = await runAssetsCli(
            [...localPlan, '--json'],
            test.dependencies
        );
        const output = JSON.parse(test.stdout()) as PublisherReportV1;

        expect(exit).toBe(3);
        expect(output.errors).toEqual([
            expect.objectContaining({
                code: 'storage',
                stage: 'upload',
            }),
        ]);
    });

    it('falls back to the input stage when the error carries no stage context', async () => {
        const test = harness(async () => {
            throw new PublisherError('input', 'invalid story id', {
                context: { input: 'story' },
            });
        });

        const exit = await runAssetsCli(
            [...localPlan, '--json'],
            test.dependencies
        );
        const output = JSON.parse(test.stdout()) as PublisherReportV1;

        expect(exit).toBe(2);
        expect(output.errors).toEqual([
            expect.objectContaining({ code: 'input', stage: 'input' }),
        ]);
    });

    it('rejects an untrusted stage value from the error context', async () => {
        const secret = 'stage-injection-secret';
        const test = harness(async () => {
            throw new PublisherError('storage', `unsafe ${secret}`, {
                context: { stage: `<script>${secret}</script>` },
            });
        });

        const exit = await runAssetsCli(
            [...localPlan, '--json'],
            test.dependencies
        );
        const output = JSON.parse(test.stdout()) as PublisherReportV1;

        expect(exit).toBe(3);
        expect(output.errors).toEqual([
            expect.objectContaining({ code: 'storage', stage: 'input' }),
        ]);
        expect(`${test.stdout()}${test.stderr()}`).not.toContain(secret);
    });

    it('documents every required safe workflow in help without a store', async () => {
        const test = harness();

        await expect(runAssetsCli(['--help'], test.dependencies)).resolves.toBe(
            0
        );

        for (const example of [
            'plan --story',
            '--destination-root',
            'publish --story',
            '--environment production',
            '--no-activate',
            'mirror-preview --story',
            '--expect-manifest-sha256',
            'activate --story',
            '--environment preview',
            '--confirm-production',
            'releases --story',
            'rollback --story',
        ]) {
            expect(test.stdout()).toContain(example);
        }
        expect(test.localFactory).not.toHaveBeenCalled();
        expect(test.r2Factory).not.toHaveBeenCalled();
    });

    it('prints help for a per-command --help flag before validation or stores', async () => {
        const test = harness();

        const exit = await runAssetsCli(
            [
                'publish',
                '--story',
                'example_story',
                '--environment',
                'production',
                '--help',
            ],
            test.dependencies
        );

        expect(exit).toBe(0);
        expect(test.stdout()).toContain('Usage: assets <command> [options]');
        expect(test.localFactory).not.toHaveBeenCalled();
        expect(test.r2Factory).not.toHaveBeenCalled();
    });

    it('merges a reactivation report over the publication report', () => {
        const publication = {
            ...report('publish'),
            counts: { ...report('publish').counts, objectsCreated: 2 },
            actions: [
                {
                    stage: 'publication',
                    kind: 'create-object' as const,
                    key: 'objects/a.png',
                },
                {
                    stage: 'activation',
                    kind: 'write-pointer' as const,
                    key: 'current.json',
                },
            ],
        };
        const reactivation = {
            ...report('activate'),
            status: 'no-op' as const,
            counts: { ...report('activate').counts, pointersWritten: 1 },
            actions: [
                {
                    stage: 'activation',
                    kind: 'write-pointer' as const,
                    key: 'current.json',
                },
            ],
            pointer: {
                beforeReleaseId: `sha256-${'a'.repeat(64)}`,
                afterReleaseId: `sha256-${'b'.repeat(64)}`,
                changed: true,
            },
        };

        const merged = mergePublicationWithReactivation(
            publication,
            reactivation
        );

        expect(merged.status).toBe('no-op');
        expect(merged.counts.objectsCreated).toBe(2);
        expect(merged.counts.pointersWritten).toBe(1);
        expect(merged.actions).toEqual([
            {
                stage: 'publication',
                kind: 'create-object',
                key: 'objects/a.png',
            },
            {
                stage: 'activation',
                kind: 'write-pointer',
                key: 'current.json',
            },
        ]);
        expect(merged.pointer).toEqual(reactivation.pointer);
    });

    it('normalizes relative roots against the injected repository root', async () => {
        const runCommand = vi.fn(async parsed => report(parsed.command));
        const test = harness(runCommand);

        await runAssetsCli(
            localPlan.map(value =>
                value === '/tmp/aquila-delivery' ? '.tmp/delivery' : value
            ),
            test.dependencies
        );

        expect(test.localFactory).toHaveBeenCalledWith(
            resolve('/workspace/aquila', '.tmp/delivery')
        );
    });

    it('adapts multiple release summaries into usable path-free report data', () => {
        const command = {
            command: 'releases',
            storyId: 'example_story',
            target: { kind: 'production' },
        } as ParsedAssetsCommand;
        const first = `sha256-${'a'.repeat(64)}`;
        const second = `sha256-${'b'.repeat(64)}`;

        const result = buildReleaseListReport(command, [
            {
                releaseId: first,
                manifestPath: '/private/first.json',
                manifestSha256: 'c'.repeat(64) as never,
                manifestValid: true,
                releaseIdentityValid: true,
                shallowVerified: true,
                deepVerified: true,
                active: true,
            },
            {
                releaseId: second,
                manifestPath: '/private/second.json',
                manifestValid: true,
                releaseIdentityValid: true,
                shallowVerified: true,
                deepVerified: false,
                active: false,
            },
        ]);

        expect(result.releases).toEqual([
            expect.objectContaining({ releaseId: first, active: true }),
            expect.objectContaining({ releaseId: second, active: false }),
        ]);
        expect(JSON.stringify(result)).not.toContain('/private/');
    });
});
