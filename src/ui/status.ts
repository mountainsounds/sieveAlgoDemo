import type { Step } from '../algorithms/types';

/** Plain-language narration for each step. */
export function statusText(step: Step): string {
  switch (step.kind) {
    case 'init':
      return `n = ${step.n} — candidates 0 through ${step.n - 1}`;
    case 'strike-units':
      return '0 and 1 are not prime';
    case 'prime-found':
      return `${step.i} is prime — striking its multiples`;
    case 'composite-skip':
      return `${step.i} is already struck — skipping`;
    case 'strike':
      return `${step.value} = ${step.factor} × ${step.multiplier} — struck`;
    case 'sweep-done':
      return 'sweep complete — every unstruck number is prime';
    case 'count-visit':
      return step.prime ? `${step.i} is prime — count = ${step.count}` : `${step.i} — struck`;
    case 'done':
      return `${step.count} primes below ${step.n}`;
  }
}
