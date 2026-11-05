import { ProviderClient, GenerationTaskOptions, GenerationTaskResult, SupportedProvider } from './types';
import { TripoClient } from './tripo';
import { RodinClient } from './rodin';
import { MeshyClient } from './meshy';
import { Mock3DClient } from './mock';
import { FalProvider } from './fal';
import { env } from '@/env';

export * from './types';

const tripo = new TripoClient();
const rodin = new RodinClient();
const meshy = new MeshyClient();
const mock = new Mock3DClient();
const fal = new FalProvider();

/**
 * Dispatch 3D generation task with automated provider failover.
 * If TRIPO_API_KEY is dummy/unconfigured, falls back to Mock provider for local development.
 */
export async function dispatchGenerationTask(
  options: GenerationTaskOptions,
  preferredProvider?: SupportedProvider
): Promise<GenerationTaskResult> {
  const isMockMode =
    !env.TRIPO_API_KEY ||
    env.TRIPO_API_KEY.startsWith('tsk_xxx') ||
    env.TRIPO_API_KEY === 'mock';

  if (isMockMode || preferredProvider === 'mock') {
    return mock.submitTask(options);
  }

  // Primary provider routing
  const primary: ProviderClient =
    preferredProvider === 'fal'
      ? fal
      : preferredProvider === 'rodin'
        ? rodin
        : preferredProvider === 'meshy'
          ? meshy
          : tripo;

  try {
    return await primary.submitTask(options);
  } catch (primaryErr) {
    console.warn(`Primary provider (${primary.name}) failed, attempting failover:`, primaryErr);

    // Failover sequence: Tripo -> Meshy -> Rodin
    if (primary.name !== 'meshy' && env.MESHY_API_KEY && !env.MESHY_API_KEY.startsWith('xxx')) {
      try {
        console.log('Failing over to Meshy API...');
        return await meshy.submitTask(options);
      } catch (meshyErr) {
        console.error('Meshy failover failed:', meshyErr);
      }
    }

    throw primaryErr;
  }
}
