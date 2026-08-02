import type { AlgorithmDef } from './types';
import { sieve } from './sieve';

/** Registry — additional algorithms slot in here. */
export const algorithms: readonly AlgorithmDef[] = [sieve];
