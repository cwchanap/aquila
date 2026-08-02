import { fileURLToPath } from 'node:url';
import { runAssetsCli } from './publisher/cli';

type PublisherCli = (argv: readonly string[]) => Promise<number>;

const fixturePath = fileURLToPath(
    new URL(
        './publisher/__fixtures__/smoke-release-plan.v1.json',
        import.meta.url
    )
);

export async function runSmokeSeed(
    runPublisher: PublisherCli = runAssetsCli
): Promise<number> {
    return runPublisher([
        'publish',
        '--story',
        'the_seventh_mirror',
        '--environment',
        'preview',
        '--preview-id',
        'smoke',
        '--plan',
        fixturePath,
        '--source-root',
        'packages/assets/media',
        '--destination',
        'r2',
    ]);
}

/* v8 ignore next 3 */
if ((import.meta as ImportMeta & { main?: boolean }).main === true) {
    process.exitCode = await runSmokeSeed();
}
