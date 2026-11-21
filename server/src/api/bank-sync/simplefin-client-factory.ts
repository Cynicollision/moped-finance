import { DevelopmentSimplefinClient } from './fake';
import { ISimplefinClient, SimplefinClient } from './simplefin-client';

/**
 * The client bank sync uses: SimpleFIN Bridge itself, or with `SIMPLEFIN_FAKE=true` in development, Bridge for real
 * setup tokens and the fake Bridge for `fake` ones. Throws, so the server refuses to start, when the fake is turned on
 * in production or `SIMPLEFIN_FAKE` is neither true nor false.
 */
export function simplefinClientFromEnvironment(env: NodeJS.ProcessEnv): {
    client: ISimplefinClient;
    usesFake: boolean;
} {
    const text = env.SIMPLEFIN_FAKE?.trim().toLowerCase() ?? '';
    if (text !== '' && text !== 'true' && text !== 'false') {
        throw new Error(`SIMPLEFIN_FAKE must be true or false, not '${env.SIMPLEFIN_FAKE}'.`);
    }
    const real = new SimplefinClient();
    if (text !== 'true') {
        return { client: real, usesFake: false };
    }
    if (env.NODE_ENV === 'production') {
        throw new Error('SIMPLEFIN_FAKE is for development only. Remove it from the production environment.');
    }
    return { client: new DevelopmentSimplefinClient(real), usesFake: true };
}
