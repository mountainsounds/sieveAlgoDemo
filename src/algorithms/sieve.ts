import type { AlgorithmDef, Step } from './types';

/** Counts primes below n (LeetCode "Count Primes" semantics). */
export function countPrimes(n: number): number {
  const isPrime = new Array<boolean>(n).fill(true);
  if (n > 0) isPrime[0] = false;
  if (n > 1) isPrime[1] = false;

  for (let i = 2; i * i < n; i++) {
    if (isPrime[i]) {
      for (let j = i * i; j < n; j += i) {
        isPrime[j] = false;
      }
    }
  }

  let count = 0;
  for (let i = 2; i < n; i++) {
    if (isPrime[i]) count++;
  }
  return count;
}

export function buildSteps(n: number): Step[] {
  const steps: Step[] = [{ kind: 'init', n }, { kind: 'strike-units' }];
  const isPrime = new Array<boolean>(n).fill(true);
  isPrime[0] = false;
  isPrime[1] = false;

  for (let i = 2; i * i < n; i++) {
    if (isPrime[i]) {
      steps.push({ kind: 'prime-found', i });
      for (let j = i * i; j < n; j += i) {
        isPrime[j] = false;
        steps.push({ kind: 'strike', value: j, factor: i, multiplier: j / i });
      }
    } else {
      steps.push({ kind: 'composite-skip', i });
    }
  }
  steps.push({ kind: 'sweep-done' });

  let count = 0;
  for (let i = 2; i < n; i++) {
    if (isPrime[i]) count++;
    steps.push({ kind: 'count-visit', i, prime: isPrime[i] === true, count });
  }
  steps.push({ kind: 'done', count, n });
  return steps;
}

const jsListing = {
  language: 'javascript',
  label: 'countPrimes.js',
  code: `function countPrimes(n) {
  const isPrime = new Array(n).fill(true);
  isPrime[0] = isPrime[1] = false;

  for (let i = 2; i * i < n; i++) {
    if (isPrime[i]) {
      for (let j = i * i; j < n; j += i) {
        isPrime[j] = false;
      }
    }
  }

  let count = 0;
  for (let i = 2; i < n; i++) {
    if (isPrime[i]) count++;
  }
  return count;
}`,
  lineFor(step: Step): number | null {
    switch (step.kind) {
      case 'init':
        return 2;
      case 'strike-units':
        return 3;
      case 'prime-found':
      case 'composite-skip':
        return 6;
      case 'strike':
        return 8;
      case 'sweep-done':
        return 13;
      case 'count-visit':
        return 15;
      case 'done':
        return 17;
    }
  },
};

export const sieve: AlgorithmDef = {
  id: 'sieve-of-eratosthenes',
  title: 'Sieve of Eratosthenes',
  summary: 'Counts the primes below n by striking out the multiples of each prime.',
  input: { min: 2, max: 120, default: 30 },
  buildSteps,
  result: countPrimes,
  listings: [jsListing],
};
