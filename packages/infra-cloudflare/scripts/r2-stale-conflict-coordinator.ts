import { runAssetsCli, type AssetsCliDependencies } from '../src/publisher/cli';
import { R2DeliveryStore } from '../src/publisher/stores/r2-delivery-store';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
} from '../src/publisher/stores/delivery-store';

type CoordinatorCliOverrides = Partial<
    Pick<
        AssetsCliDependencies,
        'repositoryRoot' | 'environment' | 'createLocalStore' | 'runCommand'
    >
>;

export interface StaleConflictCoordinatorOptions {
    readonly publishArgs: readonly string[];
    readonly activationArgs: readonly string[];
    readonly createPublishStore: () => DeliveryStore | Promise<DeliveryStore>;
    readonly createActivationStore: () =>
        | DeliveryStore
        | Promise<DeliveryStore>;
    readonly cliOverrides?: CoordinatorCliOverrides;
}

export interface StaleConflictCoordinatorResult {
    readonly publishExit: number;
    readonly activationExit?: number;
    readonly publishStdout: string;
    readonly publishStderr: string;
    readonly activationStdout: string;
    readonly activationStderr: string;
    readonly issue?: string;
}

interface CapturedStream {
    readonly stream: { write(chunk: string): boolean };
    readonly value: () => string;
}

function capturedStream(): CapturedStream {
    let value = '';
    return {
        stream: {
            write(chunk) {
                value += String(chunk);
                return true;
            },
        },
        value: () => value,
    };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
    let settled = false;
    let resolvePromise!: () => void;
    const promise = new Promise<void>(resolve => {
        resolvePromise = resolve;
    });
    return {
        promise,
        resolve: () => {
            if (settled) return;
            settled = true;
            resolvePromise();
        },
    };
}

function barrierStore(
    store: DeliveryStore,
    reached: () => void,
    released: Promise<void>
): DeliveryStore {
    let immutableCreateCount = 0;
    return {
        stat: key => store.stat(key),
        read: key => store.read(key),
        createImmutable: async (request: ImmutableCreateRequest) => {
            immutableCreateCount += 1;
            if (immutableCreateCount === 1) {
                // Publication planning, including its advisory pointer read,
                // precedes every immutable create. Pausing the first actual
                // create therefore works even when every object is reused and
                // only the run-specific preview manifest needs creating.
                reached();
                await released;
            }
            return store.createImmutable(request);
        },
        inspectPointer: key => store.inspectPointer(key),
        readPointer: key => store.readPointer(key),
        compareAndSwapPointer: request => store.compareAndSwapPointer(request),
        listKeys: prefix => store.listKeys(prefix),
        list: prefix => store.list(prefix),
        close: () => store.close(),
    };
}

export async function coordinateStaleConflict(
    options: StaleConflictCoordinatorOptions
): Promise<StaleConflictCoordinatorResult> {
    const reached = deferred();
    const release = deferred();
    const publishStdout = capturedStream();
    const publishStderr = capturedStream();
    const activationStdout = capturedStream();
    const activationStderr = capturedStream();
    const commonOverrides = options.cliOverrides ?? {};

    const publishPromise = runAssetsCli(options.publishArgs, {
        ...commonOverrides,
        createR2Store: async () =>
            barrierStore(
                await options.createPublishStore(),
                reached.resolve,
                release.promise
            ),
        stdout: publishStdout.stream,
        stderr: publishStderr.stream,
    });

    let publishExit: number | undefined;
    let activationExit: number | undefined;
    let issue: string | undefined;
    try {
        const first = await Promise.race([
            reached.promise.then(() => ({ kind: 'reached' as const })),
            publishPromise.then(exit => ({
                kind: 'publish-exit' as const,
                exit,
            })),
        ]);
        if (first.kind === 'publish-exit') {
            publishExit = first.exit;
            issue = 'publish-ended-before-barrier';
        } else {
            try {
                activationExit = await runAssetsCli(options.activationArgs, {
                    ...commonOverrides,
                    createR2Store: options.createActivationStore,
                    stdout: activationStdout.stream,
                    stderr: activationStderr.stream,
                });
                if (activationExit !== 0) {
                    issue = `activation-exit-${activationExit}`;
                }
            } catch {
                issue = 'activation-threw';
            }
        }
    } catch {
        issue = 'publish-threw';
    } finally {
        release.resolve();
        if (publishExit === undefined) {
            try {
                publishExit = await publishPromise;
            } catch {
                publishExit = 1;
                issue ??= 'publish-threw';
            }
        }
    }

    return {
        publishExit,
        ...(activationExit === undefined ? {} : { activationExit }),
        publishStdout: publishStdout.value(),
        publishStderr: publishStderr.value(),
        activationStdout: activationStdout.value(),
        activationStderr: activationStderr.value(),
        ...(issue === undefined ? {} : { issue }),
    };
}

function requiredEnvironment(name: string): string {
    const value = process.env[name];
    if (value === undefined || value.length === 0) {
        throw new Error(`missing ${name}`);
    }
    return value;
}

async function runWorkflowCoordinator(): Promise<number> {
    const storyId = requiredEnvironment('STORY_ID');
    const previewId = requiredEnvironment('PREVIEW_ID');
    const releaseId = requiredEnvironment('RELEASE_B');
    const manifestSha256 = requiredEnvironment('MANIFEST_B');
    const repositoryRoot = requiredEnvironment('GITHUB_WORKSPACE');
    const result = await coordinateStaleConflict({
        publishArgs: [
            'publish',
            '--story',
            storyId,
            '--environment',
            'preview',
            '--preview-id',
            previewId,
            '--plan',
            `${repositoryRoot}/.tmp/production-fixture-plan.json`,
            '--source-root',
            `${repositoryRoot}/.tmp/source-c`,
            '--destination',
            'r2',
            '--json',
        ],
        activationArgs: [
            'activate',
            '--story',
            storyId,
            '--environment',
            'preview',
            '--preview-id',
            previewId,
            '--release',
            releaseId,
            '--expect-manifest-sha256',
            manifestSha256,
            '--destination',
            'r2',
            '--reactivate',
            '--json',
        ],
        createPublishStore: () => R2DeliveryStore.createFromEnvironment(),
        createActivationStore: () => R2DeliveryStore.createFromEnvironment(),
    });
    await Promise.all([
        Bun.write('.tmp/reports/stale-conflict.json', result.publishStdout),
        Bun.write('.tmp/evidence/stale-conflict.stderr', result.publishStderr),
        Bun.write(
            '.tmp/reports/stale-drift-reactivate.json',
            result.activationStdout
        ),
        Bun.write(
            '.tmp/evidence/stale-drift-reactivate.stderr',
            result.activationStderr
        ),
        Bun.write(
            '.tmp/evidence/stale-conflict-coordinator.json',
            `${JSON.stringify(
                {
                    schemaVersion: 1,
                    publishExit: result.publishExit,
                    ...(result.activationExit === undefined
                        ? {}
                        : { activationExit: result.activationExit }),
                    ...(result.issue === undefined
                        ? {}
                        : { issue: result.issue }),
                },
                null,
                2
            )}\n`
        ),
    ]);
    return result.publishExit;
}

/* v8 ignore next 3 */
if ((import.meta as ImportMeta & { main?: boolean }).main === true) {
    process.exitCode = await runWorkflowCoordinator();
}
