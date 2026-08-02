import { realpath } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import {
    assertSha256,
    getCurrentPointerPath,
    isPreviewId,
    isReleaseId,
    isStoryId,
    type ManifestByteSha256,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { activateStoredRelease, type ActivationResult } from './activation';
import { verifyStoredRelease } from './candidate-verifier';
import { PublisherError, publisherExitCode } from './errors';
import { mirrorProductionReleaseToPreview } from './mirror-preview';
import { buildPublicationPlan } from './publication-plan';
import { publishRelease } from './publish';
import {
    listReleases,
    rollbackRelease,
    type ReleaseSummary,
} from './release-history';
import {
    createHumanProgressSink,
    publisherReportExitCode,
    renderHumanReport,
    renderJsonReport,
    safeStage,
    type ProgressSink,
    type PublisherDiagnosticV1,
    type PublisherReportV1,
} from './report';
import type { DeliveryStore } from './stores/delivery-store';
import { LocalDeliveryStore } from './stores/local-delivery-store';
import { R2DeliveryStore } from './stores/r2-delivery-store';
import type { PublicationDestination, PublisherCommandName } from './types';

interface WritableStream {
    write(chunk: string): unknown;
}

interface BaseParsedCommand {
    readonly command: PublisherCommandName;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly destination: PublicationDestination;
    readonly store: DeliveryStore;
    readonly repositoryRoot: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly progress?: ProgressSink;
    readonly releaseId?: string;
    readonly expectedManifestSha256?: ManifestByteSha256;
    readonly releasePlanPath?: string;
    readonly sourceRoot?: string;
    readonly noActivate?: boolean;
    readonly reactivate?: boolean;
    readonly overrideConcurrentPointer?: boolean;
    readonly confirmProduction?: string;
    readonly deep?: boolean;
}

export type ParsedAssetsCommand = BaseParsedCommand;

export type AssetsCommandRunner = (
    command: ParsedAssetsCommand
) => Promise<PublisherReportV1>;

export interface AssetsCliDependencies {
    repositoryRoot: string;
    environment: Readonly<Record<string, string | undefined>>;
    createLocalStore: (root: string) => DeliveryStore | Promise<DeliveryStore>;
    createR2Store: () => DeliveryStore | Promise<DeliveryStore>;
    runCommand: AssetsCommandRunner;
    stdout: WritableStream;
    stderr: WritableStream;
}

type CliValues = Readonly<Record<string, string | boolean | undefined>>;
type OptionSchema = NonNullable<ParseArgsConfig['options']>;

const COMMANDS = new Set<PublisherCommandName>([
    'plan',
    'publish',
    'mirror-preview',
    'activate',
    'verify',
    'releases',
    'rollback',
]);

const commonOptions = {
    story: { type: 'string' },
    destination: { type: 'string' },
    'destination-root': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
} as const satisfies OptionSchema;

const targetedOptions = {
    ...commonOptions,
    environment: { type: 'string' },
    'preview-id': { type: 'string' },
} as const satisfies OptionSchema;

const planOptions = {
    ...targetedOptions,
    plan: { type: 'string' },
    'source-root': { type: 'string' },
} as const satisfies OptionSchema;

const publishOptions = {
    ...planOptions,
    'no-activate': { type: 'boolean' },
    reactivate: { type: 'boolean' },
    'override-concurrent-pointer': { type: 'boolean' },
    'confirm-production': { type: 'string' },
} as const satisfies OptionSchema;

const mirrorPreviewOptions = {
    ...commonOptions,
    release: { type: 'string' },
    'preview-id': { type: 'string' },
    'expect-manifest-sha256': { type: 'string' },
} as const satisfies OptionSchema;

const activateOptions = {
    ...targetedOptions,
    release: { type: 'string' },
    'expect-manifest-sha256': { type: 'string' },
    reactivate: { type: 'boolean' },
    'override-concurrent-pointer': { type: 'boolean' },
    'confirm-production': { type: 'string' },
} as const satisfies OptionSchema;

const verifyOptions = {
    ...targetedOptions,
    release: { type: 'string' },
    'expect-manifest-sha256': { type: 'string' },
    deep: { type: 'boolean' },
} as const satisfies OptionSchema;

const releasesOptions = {
    ...targetedOptions,
    deep: { type: 'boolean' },
} as const satisfies OptionSchema;

const rollbackOptions = {
    ...targetedOptions,
    release: { type: 'string' },
    'expect-manifest-sha256': { type: 'string' },
    'override-concurrent-pointer': { type: 'boolean' },
    'confirm-production': { type: 'string' },
} as const satisfies OptionSchema;

const HELP = `Usage: assets <command> [options]

Commands: plan, publish, mirror-preview, activate, verify, releases, rollback

Examples:
  assets plan --story example_story --environment preview --preview-id local-check --destination local --destination-root .tmp/aquila-assets
  assets publish --story example_story --environment production --destination r2 --no-activate
  assets mirror-preview --story example_story --release sha256-<digest> --preview-id gate-123 --expect-manifest-sha256 <digest> --destination r2
  assets activate --story example_story --environment preview --preview-id gate-123 --release sha256-<digest> --destination r2
  assets activate --story example_story --environment production --release sha256-<digest> --confirm-production example_story --destination r2
  assets releases --story example_story --environment production --destination r2
  assets rollback --story example_story --environment production --release sha256-<digest> --confirm-production example_story --destination r2
`;

const defaultRepositoryRoot = fileURLToPath(
    new URL('../../../../', import.meta.url)
);

function optionsFor(command: PublisherCommandName): OptionSchema {
    switch (command) {
        case 'plan':
            return planOptions;
        case 'publish':
            return publishOptions;
        case 'mirror-preview':
            return mirrorPreviewOptions;
        case 'activate':
            return activateOptions;
        case 'verify':
            return verifyOptions;
        case 'releases':
            return releasesOptions;
        case 'rollback':
            return rollbackOptions;
    }
}

function configurationError(message: string): PublisherError {
    return new PublisherError('configuration', message, {
        context: { stage: 'input' },
    });
}

function requiredString(values: CliValues, key: string): string {
    const value = values[key];
    if (typeof value !== 'string' || value.length === 0) {
        throw configurationError(`Missing required --${key}`);
    }
    return value;
}

function parseCommandName(value: string | undefined): PublisherCommandName {
    if (value === undefined || !COMMANDS.has(value as PublisherCommandName)) {
        throw configurationError('Unknown or missing assets command');
    }
    return value as PublisherCommandName;
}

function parseTarget(values: CliValues): PublicationTarget {
    const environment = requiredString(values, 'environment');
    const previewId = values['preview-id'];
    if (environment === 'production') {
        if (previewId !== undefined) {
            throw configurationError(
                'Production commands must not provide --preview-id'
            );
        }
        return { kind: 'production' };
    }
    if (environment !== 'preview') {
        throw configurationError('--environment must be production or preview');
    }
    if (typeof previewId !== 'string' || !isPreviewId(previewId)) {
        throw configurationError(
            'Preview commands require a valid --preview-id'
        );
    }
    return { kind: 'preview', previewId };
}

function parseStoryId(values: CliValues): string {
    const storyId = requiredString(values, 'story');
    if (!isStoryId(storyId)) {
        throw new PublisherError('input', 'Invalid story id', {
            context: { input: 'story' },
        });
    }
    return storyId;
}

function parseReleaseId(
    values: CliValues,
    command: PublisherCommandName
): string {
    const releaseId = requiredString(values, 'release');
    if (!isReleaseId(releaseId)) {
        throw new PublisherError(
            command === 'activate' || command === 'rollback'
                ? 'activation-target'
                : 'input',
            'Invalid release id',
            { context: { input: 'release' } }
        );
    }
    return releaseId;
}

function parseExpectedManifestSha256(
    values: CliValues
): ManifestByteSha256 | undefined {
    const value = values['expect-manifest-sha256'];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
        throw configurationError('Invalid --expect-manifest-sha256');
    }
    try {
        return assertSha256<'manifest-bytes'>(value);
    } catch {
        throw new PublisherError('input', 'Invalid manifest checksum', {
            context: { input: 'expect-manifest-sha256' },
        });
    }
}

function pathContains(parent: string, child: string): boolean {
    return child === parent || child.startsWith(`${parent}${sep}`);
}

async function canonicalPath(path: string): Promise<string> {
    let cursor = path;
    const missingSegments: string[] = [];
    while (true) {
        try {
            const existing = await realpath(cursor);
            return resolve(existing, ...missingSegments);
        } catch (error) {
            const code =
                typeof error === 'object' && error !== null && 'code' in error
                    ? (error as { code?: unknown }).code
                    : undefined;
            if (code !== 'ENOENT' && code !== 'ENOTDIR') {
                throw configurationError(
                    'Unable to canonicalize publisher path'
                );
            }
            const parent = dirname(cursor);
            if (parent === cursor) return resolve(path);
            missingSegments.unshift(basename(cursor));
            cursor = parent;
        }
    }
}

async function assertDestinationPathSafety(
    repositoryRoot: string,
    destinationRoot: string,
    sourceRoot: string | undefined,
    releasePlanPath: string | undefined
): Promise<void> {
    const canonicalRepository = await canonicalPath(repositoryRoot);
    const canonicalDestination = await canonicalPath(destinationRoot);
    if (pathContains(canonicalDestination, canonicalRepository)) {
        throw configurationError(
            'Local destination must not contain the repository root'
        );
    }
    if (sourceRoot !== undefined) {
        const resolvedSource = await canonicalPath(
            resolve(repositoryRoot, sourceRoot)
        );
        if (
            pathContains(resolvedSource, canonicalDestination) ||
            pathContains(canonicalDestination, resolvedSource)
        ) {
            throw configurationError(
                'Local destination and source root must not overlap'
            );
        }
    }
    if (releasePlanPath !== undefined) {
        const resolvedPlan = await canonicalPath(
            resolve(repositoryRoot, releasePlanPath)
        );
        if (pathContains(canonicalDestination, resolvedPlan)) {
            throw configurationError(
                'Local destination must not contain the release plan'
            );
        }
    }
}

async function parseDestination(
    values: CliValues,
    repositoryRoot: string,
    sourceRoot: string | undefined,
    releasePlanPath: string | undefined,
    environment: Readonly<Record<string, string | undefined>>
): Promise<PublicationDestination> {
    const selected = values.destination ?? 'local';
    const root = values['destination-root'];
    if (selected === 'local') {
        if (typeof root !== 'string' || root.length === 0) {
            throw configurationError(
                'Local destination requires --destination-root'
            );
        }
        const resolvedRoot = resolve(repositoryRoot, root);
        await assertDestinationPathSafety(
            repositoryRoot,
            resolvedRoot,
            sourceRoot,
            releasePlanPath
        );
        return { kind: 'local', root: resolvedRoot };
    }
    if (selected !== 'r2') {
        throw configurationError('--destination must be local or r2');
    }
    if (root !== undefined) {
        throw configurationError('R2 destination rejects --destination-root');
    }
    if (
        !environment.R2_PUBLISHER_ACCESS_KEY_ID ||
        !environment.R2_PUBLISHER_SECRET_ACCESS_KEY
    ) {
        throw configurationError(
            'R2 publisher credentials are not completely configured'
        );
    }
    return { kind: 'r2' };
}

function assertPublishMatrix(
    values: CliValues,
    storyId: string,
    target: PublicationTarget
): void {
    if (
        values['no-activate'] === true &&
        (values.reactivate === true ||
            values['override-concurrent-pointer'] === true)
    ) {
        throw configurationError(
            '--no-activate is incompatible with pointer mutation flags'
        );
    }
    if (
        target.kind === 'production' &&
        values['no-activate'] !== true &&
        values['confirm-production'] !== storyId
    ) {
        throw new PublisherError(
            'activation-target',
            'Production publish requires exact story confirmation'
        );
    }
}

function assertProductionMutationConfirmation(
    values: CliValues,
    storyId: string,
    target: PublicationTarget
): void {
    if (
        target.kind === 'production' &&
        values['confirm-production'] !== storyId
    ) {
        throw new PublisherError(
            'activation-target',
            'Production pointer mutation requires exact story confirmation'
        );
    }
}

function parseValues(
    command: PublisherCommandName,
    args: readonly string[]
): CliValues {
    try {
        const parsed = parseArgs({
            args: [...args],
            options: optionsFor(command),
            strict: true,
            allowPositionals: false,
        });
        const values: Record<string, string | boolean | undefined> = {};
        for (const [key, value] of Object.entries(parsed.values)) {
            if (Array.isArray(value)) {
                throw configurationError(
                    'Repeated command options are invalid'
                );
            }
            values[key] = value;
        }
        return values;
    } catch {
        throw configurationError('Invalid command options');
    }
}

function baseCommand(
    command: PublisherCommandName,
    values: CliValues,
    dependencies: AssetsCliDependencies
): Omit<BaseParsedCommand, 'destination' | 'store'> {
    const storyId = parseStoryId(values);
    const target =
        command === 'mirror-preview'
            ? {
                  kind: 'preview' as const,
                  previewId: (() => {
                      const value = requiredString(values, 'preview-id');
                      if (!isPreviewId(value)) {
                          throw configurationError('Invalid --preview-id');
                      }
                      return value;
                  })(),
              }
            : parseTarget(values);
    if (command === 'publish') {
        assertPublishMatrix(values, storyId, target);
    } else if (command === 'activate' || command === 'rollback') {
        assertProductionMutationConfirmation(values, storyId, target);
    }
    const expectedManifestSha256 = parseExpectedManifestSha256(values);
    const requiresRelease =
        command === 'mirror-preview' ||
        command === 'activate' ||
        command === 'verify' ||
        command === 'rollback';
    const releaseId = requiresRelease
        ? parseReleaseId(values, command)
        : undefined;
    // Resolve relative explicit and environment paths against the repository
    // root once, so destination-overlap safety validation and the source/plan
    // loaders read the same filesystem location. Without this, safety
    // validation resolves relative values against repositoryRoot while the
    // loaders resolve them against process.cwd(); running the CLI outside the
    // repository root would then validate one location and read another,
    // bypassing the source/destination overlap guard. Absolute paths pass
    // through `resolve` unchanged. The default fallbacks
    // (packages/assets/media and packages/stories/release-plans/<story>.json)
    // are already resolved against repositoryRoot by the loaders, so they are
    // left undefined here and handled by each loader.
    const explicitPlanPath =
        values.plan === undefined ? undefined : String(values.plan);
    const explicitSourceRoot =
        values['source-root'] === undefined
            ? undefined
            : String(values['source-root']);
    const envSourceRoot = dependencies.environment.AQUILA_ASSET_SOURCE_ROOT;
    const releasePlanPath =
        explicitPlanPath === undefined
            ? undefined
            : resolve(dependencies.repositoryRoot, explicitPlanPath);
    const sourceRoot =
        explicitSourceRoot !== undefined
            ? resolve(dependencies.repositoryRoot, explicitSourceRoot)
            : envSourceRoot !== undefined
              ? resolve(dependencies.repositoryRoot, envSourceRoot)
              : undefined;
    return {
        command,
        storyId,
        target,
        repositoryRoot: dependencies.repositoryRoot,
        environment: dependencies.environment,
        ...(releasePlanPath === undefined ? {} : { releasePlanPath }),
        ...(sourceRoot === undefined ? {} : { sourceRoot }),
        ...(releaseId === undefined ? {} : { releaseId }),
        ...(expectedManifestSha256 === undefined
            ? {}
            : { expectedManifestSha256 }),
        ...(values['no-activate'] === true ? { noActivate: true } : {}),
        ...(values.reactivate === true ? { reactivate: true } : {}),
        ...(values['override-concurrent-pointer'] === true
            ? { overrideConcurrentPointer: true }
            : {}),
        ...(typeof values['confirm-production'] === 'string'
            ? { confirmProduction: values['confirm-production'] }
            : {}),
        ...(values.deep === true ? { deep: true } : {}),
    };
}

async function createStore(
    destination: PublicationDestination,
    dependencies: AssetsCliDependencies
): Promise<DeliveryStore> {
    return destination.kind === 'local'
        ? dependencies.createLocalStore(destination.root)
        : dependencies.createR2Store();
}

function emptyCounts(pointerWritten = false): PublisherReportV1['counts'] {
    return {
        included: 0,
        omitted: 0,
        objectsCreated: 0,
        objectsReused: 0,
        manifestsCreated: 0,
        manifestsReused: 0,
        pointersWritten: pointerWritten ? 1 : 0,
    };
}

function activationReport(
    command: ParsedAssetsCommand,
    activation: ActivationResult
): PublisherReportV1 {
    const changed = activation.status === 'success';
    return {
        schemaVersion: 1,
        command: 'activate',
        status: activation.status,
        storyId: command.storyId,
        target: command.target,
        releaseId: activation.releaseId,
        manifestSha256: activation.manifestSha256,
        counts: emptyCounts(changed),
        actions: [
            changed
                ? {
                      stage: 'activation',
                      kind: 'write-pointer',
                      key: getCurrentPointerPath(
                          command.storyId,
                          command.target
                      ),
                  }
                : { stage: 'activation', kind: 'no-op' },
        ],
        warnings: [],
        errors: [],
        pointer: {
            ...(activation.pointerBefore === undefined
                ? {}
                : { beforeReleaseId: activation.pointerBefore.releaseId }),
            ...(activation.pointerAfter === undefined
                ? activation.status === 'no-op'
                    ? { afterReleaseId: activation.releaseId }
                    : {}
                : { afterReleaseId: activation.pointerAfter.releaseId }),
            changed,
        },
    };
}

export function buildReleaseListReport(
    command: Pick<ParsedAssetsCommand, 'storyId' | 'target'>,
    releases: readonly ReleaseSummary[],
    warnings: readonly PublisherDiagnosticV1[] = []
): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command: 'releases',
        status: releases.length === 0 ? 'no-op' : 'success',
        storyId: command.storyId,
        target: command.target,
        counts: { ...emptyCounts(), included: releases.length },
        actions: [],
        warnings: [...warnings],
        errors: [],
        releases: releases.map(release => ({
            releaseId: release.releaseId,
            ...(release.manifestSha256 === undefined
                ? {}
                : { manifestSha256: release.manifestSha256 }),
            manifestValid: release.manifestValid,
            releaseIdentityValid: release.releaseIdentityValid,
            shallowVerified: release.shallowVerified,
            deepVerified: release.deepVerified,
            active: release.active,
        })),
    };
}

async function runCommandServices(
    command: ParsedAssetsCommand
): Promise<PublisherReportV1> {
    switch (command.command) {
        case 'plan':
            return (
                await buildPublicationPlan({
                    store: command.store,
                    repositoryRoot: command.repositoryRoot,
                    storyId: command.storyId,
                    target: command.target,
                    environment: command.environment,
                    progress: command.progress,
                    ...(command.releasePlanPath === undefined
                        ? {}
                        : { releasePlanPath: command.releasePlanPath }),
                    ...(command.sourceRoot === undefined
                        ? {}
                        : { sourceRoot: command.sourceRoot }),
                })
            ).report;
        case 'publish': {
            const publication = await publishRelease({
                store: command.store,
                repositoryRoot: command.repositoryRoot,
                storyId: command.storyId,
                target: command.target,
                environment: command.environment,
                progress: command.progress,
                noActivate:
                    command.reactivate === true ? true : command.noActivate,
                overrideConcurrentPointer:
                    command.reactivate === true
                        ? false
                        : command.overrideConcurrentPointer,
                confirmProduction: command.confirmProduction,
                ...(command.releasePlanPath === undefined
                    ? {}
                    : { releasePlanPath: command.releasePlanPath }),
                ...(command.sourceRoot === undefined
                    ? {}
                    : { sourceRoot: command.sourceRoot }),
            });
            if (command.reactivate !== true) return publication;
            const reactivation = activationReport(
                command,
                await activateStoredRelease({
                    store: command.store,
                    storyId: command.storyId,
                    target: command.target,
                    releaseId: publication.releaseId!,
                    expectedManifestSha256:
                        publication.manifestSha256 === undefined
                            ? undefined
                            : assertSha256<'manifest-bytes'>(
                                  publication.manifestSha256
                              ),
                    reactivate: true,
                    overrideConcurrentPointer:
                        command.overrideConcurrentPointer,
                    confirmProduction: command.confirmProduction,
                })
            );
            return mergePublicationWithReactivation(publication, reactivation);
        }
        case 'mirror-preview': {
            if (command.target.kind !== 'preview') {
                throw configurationError(
                    'mirror-preview requires a preview target'
                );
            }
            return mirrorProductionReleaseToPreview({
                store: command.store,
                storyId: command.storyId,
                sourceTarget: { kind: 'production' },
                releaseId: command.releaseId!,
                previewId: command.target.previewId,
                expectedManifestSha256: command.expectedManifestSha256,
            });
        }
        case 'activate':
            return activationReport(
                command,
                await activateStoredRelease({
                    store: command.store,
                    storyId: command.storyId,
                    target: command.target,
                    releaseId: command.releaseId!,
                    expectedManifestSha256: command.expectedManifestSha256,
                    reactivate: command.reactivate,
                    overrideConcurrentPointer:
                        command.overrideConcurrentPointer,
                    confirmProduction: command.confirmProduction,
                })
            );
        case 'verify': {
            const verified = await verifyStoredRelease({
                store: command.store,
                storyId: command.storyId,
                target: command.target,
                releaseId: command.releaseId!,
                expectedManifestSha256: command.expectedManifestSha256,
                depth: command.deep === true ? 'deep' : 'shallow',
            });
            return {
                schemaVersion: 1,
                command: 'verify',
                status: 'success',
                storyId: command.storyId,
                target: command.target,
                releaseId: verified.releaseId,
                manifestSha256: verified.manifestSha256,
                counts: {
                    ...emptyCounts(),
                    included: verified.manifest.assets.length,
                },
                actions: [],
                warnings: [],
                errors: [],
            };
        }
        case 'releases': {
            const warnings: PublisherDiagnosticV1[] = [];
            const releases = await listReleases({
                store: command.store,
                storyId: command.storyId,
                target: command.target,
                deep: command.deep,
                onProgress: command.progress,
                onWarning: warning => warnings.push(warning),
            });
            return buildReleaseListReport(command, releases, warnings);
        }
        case 'rollback':
            return rollbackRelease({
                store: command.store,
                storyId: command.storyId,
                target: command.target,
                releaseId: command.releaseId!,
                expectedManifestSha256: command.expectedManifestSha256,
                overrideConcurrentPointer: command.overrideConcurrentPointer,
                confirmProduction: command.confirmProduction,
            });
    }
}

export function mergePublicationWithReactivation(
    publication: PublisherReportV1,
    reactivation: PublisherReportV1
): PublisherReportV1 {
    return {
        ...publication,
        status: reactivation.status,
        counts: {
            ...publication.counts,
            pointersWritten: reactivation.counts.pointersWritten,
        },
        actions: [
            ...publication.actions.filter(
                action => action.stage !== 'activation'
            ),
            ...reactivation.actions,
        ],
        pointer: reactivation.pointer,
    };
}

const defaultDependencies: AssetsCliDependencies = {
    repositoryRoot: defaultRepositoryRoot,
    environment: process.env,
    createLocalStore: root => new LocalDeliveryStore(root),
    createR2Store: () => R2DeliveryStore.createFromEnvironment(),
    runCommand: runCommandServices,
    stdout: process.stdout,
    stderr: process.stderr,
};

function errorReport(
    error: unknown,
    command: PublisherCommandName,
    storyId: string,
    target: PublicationTarget
): PublisherReportV1 {
    const code = error instanceof PublisherError ? error.code : 'storage';
    // Services attach the failed phase to PublisherError.context.stage (e.g.
    // 'upload', 'verification', 'activation', 'rollback'). Hard-coding 'input'
    // here would mislabel every storage/verification/activation failure and
    // hide the failed phase from machine-readable reports. Validate the typed
    // context value through the same stage allowlist the report sanitizer
    // uses, falling back to 'input' only when the error carries no usable
    // stage (e.g. CLI argument parsing, which genuinely fails at 'input').
    const contextStage =
        error instanceof PublisherError &&
        typeof error.context.stage === 'string'
            ? safeStage(error.context.stage)
            : 'input';
    const stage = contextStage === 'publisher' ? 'input' : contextStage;
    const timestampContext =
        error instanceof PublisherError &&
        (code === 'clock-skew' || code === 'non-monotonic-pointer-time')
            ? {
                  ...(typeof error.context.previousPublishedAt === 'string'
                      ? {
                            previousPublishedAt:
                                error.context.previousPublishedAt,
                        }
                      : {}),
                  ...(typeof error.context.localNow === 'string'
                      ? { localNow: error.context.localNow }
                      : {}),
              }
            : {};
    return {
        schemaVersion: 1,
        command,
        status: code === 'concurrency' ? 'conflict' : 'failed',
        storyId,
        target,
        counts: emptyCounts(),
        actions: [],
        warnings: [],
        errors: [
            {
                code,
                stage,
                message: 'Publisher command failed',
                ...timestampContext,
            },
        ],
    };
}

function emitReport(
    report: PublisherReportV1,
    json: boolean,
    dependencies: AssetsCliDependencies
): void {
    if (json) dependencies.stdout.write(renderJsonReport(report));
    else dependencies.stderr.write(renderHumanReport(report));
}

export async function runAssetsCli(
    argv: readonly string[],
    overrides: Partial<AssetsCliDependencies> = {}
): Promise<number> {
    const dependencies: AssetsCliDependencies = {
        ...defaultDependencies,
        ...overrides,
    };
    if (
        argv[0] === '--help' ||
        argv[0] === '-h' ||
        (argv.length === 2 && (argv[1] === '--help' || argv[1] === '-h'))
    ) {
        dependencies.stdout.write(HELP);
        return 0;
    }

    const json = argv.includes('--json');
    let command: PublisherCommandName = 'plan';
    let storyId = 'cli_error';
    let target: PublicationTarget = { kind: 'production' };
    let store: DeliveryStore | undefined;
    let finalReport: PublisherReportV1 | undefined;
    let finalError: unknown;
    try {
        command = parseCommandName(argv[0]);
        const values = parseValues(command, argv.slice(1));
        if (values.help === true) {
            dependencies.stdout.write(HELP);
            return 0;
        }
        const parsed = baseCommand(command, values, dependencies);
        storyId = parsed.storyId;
        target = parsed.target;
        const hasPublicationInputs =
            command === 'plan' || command === 'publish';
        // parsed.sourceRoot already folds in the AQUILA_ASSET_SOURCE_ROOT env
        // fallback resolved against repositoryRoot (see baseCommand). Only the
        // default source root remains relative; assertDestinationPathSafety
        // resolves it against repositoryRoot, matching resolveSourceRoot's
        // default. parsed.releasePlanPath is canonical when explicit; the
        // default plan path is resolved against repositoryRoot by both the
        // safety check and resolveReleasePlanPath.
        const sourceRootForSafety = hasPublicationInputs
            ? (parsed.sourceRoot ?? 'packages/assets/media')
            : undefined;
        const planPathForSafety = hasPublicationInputs
            ? (parsed.releasePlanPath ??
              `packages/stories/release-plans/${storyId}.json`)
            : undefined;
        const destination = await parseDestination(
            values,
            dependencies.repositoryRoot,
            sourceRootForSafety,
            planPathForSafety,
            dependencies.environment
        );
        store = await createStore(destination, dependencies);
        const progress = createHumanProgressSink(dependencies.stderr);
        finalReport = await dependencies.runCommand({
            ...parsed,
            destination,
            store,
            progress,
        });
    } catch (error) {
        finalError = error;
    } finally {
        if (store !== undefined) {
            try {
                await store.close();
            } catch {
                finalError ??= new PublisherError(
                    'storage',
                    'Unable to close selected destination store',
                    {
                        cause: {
                            classification: 'delivery-store-close-failure',
                        },
                    }
                );
            }
        }
    }
    if (finalError !== undefined) {
        finalReport = errorReport(finalError, command, storyId, target);
    }
    finalReport ??= errorReport(
        new PublisherError('storage', 'Command did not produce a report'),
        command,
        storyId,
        target
    );
    emitReport(finalReport, json, dependencies);
    return finalError === undefined
        ? publisherReportExitCode(finalReport)
        : publisherExitCode(finalError);
}

/* v8 ignore next 4 */
if ((import.meta as ImportMeta & { main?: boolean }).main === true) {
    process.exitCode = await runAssetsCli(process.argv.slice(2));
}
