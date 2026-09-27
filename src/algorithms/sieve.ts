import { defineAlgorithm, type AlgorithmDef, type ControlValues } from './types';

/** One visual moment in a sieve run. */
export type SieveStep =
  | { kind: 'init'; n: number }
  | { kind: 'strike-units' }
  | { kind: 'prime-found'; i: number }
  | { kind: 'composite-skip'; i: number }
  | { kind: 'strike'; value: number; factor: number; multiplier: number }
  | { kind: 'sweep-done' }
  | { kind: 'count-visit'; i: number; prime: boolean; count: number }
  | { kind: 'done'; count: number; n: number };

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

export function buildSteps(n: number): SieveStep[] {
  const steps: SieveStep[] = [{ kind: 'init', n }, { kind: 'strike-units' }];
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

/* Three listings of the same sieve. In each one the inner loop lives in a
   strikeMultiples helper, so the main loop reads as one plain sentence. Each is
   still written the way its language writes it. Python walks up to √n with a
   while loop rather than a C-style for. JavaScript and Python count the
   survivors in one expression, where Java loops. So each keeps its own
   step→line map, and tests/code-panel.test.ts pins every one of them to the
   line it names. */

const jsListing = {
  language: 'javascript',
  label: 'countPrimes.js',
  code: `function countPrimes(n) {
  const isPrime = new Array(n).fill(true);
  isPrime[0] = isPrime[1] = false;

  for (let i = 2; i * i < n; i++) {
    if (isPrime[i]) strikeMultiples(isPrime, i);
  }

  return isPrime.filter(Boolean).length;
}

function strikeMultiples(isPrime, p) {
  for (let m = p * p; m < isPrime.length; m += p) {
    isPrime[m] = false;
  }
}`,
  lineFor(step: SieveStep): number | null {
    switch (step.kind) {
      case 'init':
        return 2;
      case 'strike-units':
        return 3;
      case 'prime-found':
      case 'composite-skip':
        return 6;
      case 'strike':
        return 14;
      // The count is one expression, so the whole tally sits on its line.
      case 'sweep-done':
      case 'count-visit':
      case 'done':
        return 9;
    }
  },
};

const pyListing = {
  language: 'python',
  label: 'count_primes.py',
  code: `def count_primes(n):
    is_prime = [True] * n
    is_prime[0] = is_prime[1] = False

    i = 2
    while i * i < n:
        if is_prime[i]:
            strike_multiples(is_prime, i)
        i += 1

    return is_prime.count(True)


def strike_multiples(is_prime, p):
    for m in range(p * p, len(is_prime), p):
        is_prime[m] = False`,
  lineFor(step: SieveStep): number | null {
    switch (step.kind) {
      case 'init':
        return 2;
      case 'strike-units':
        return 3;
      // Python puts the call on its own line under the test, so a prime goes
      // one line further than a number that is already struck.
      case 'prime-found':
        return 8;
      case 'composite-skip':
        return 7;
      case 'strike':
        return 16;
      case 'sweep-done':
      case 'count-visit':
      case 'done':
        return 11;
    }
  },
};

const javaListing = {
  language: 'java',
  label: 'CountPrimes.java',
  code: `static int countPrimes(int n) {
  boolean[] isPrime = new boolean[n];
  Arrays.fill(isPrime, true);
  isPrime[0] = isPrime[1] = false;

  for (int i = 2; i * i < n; i++) {
    if (isPrime[i]) strikeMultiples(isPrime, i);
  }

  int count = 0;
  for (boolean prime : isPrime) {
    if (prime) count++;
  }
  return count;
}

static void strikeMultiples(boolean[] isPrime, int p) {
  for (int m = p * p; m < isPrime.length; m += p) {
    isPrime[m] = false;
  }
}`,
  lineFor(step: SieveStep): number | null {
    switch (step.kind) {
      case 'init':
        return 2;
      case 'strike-units':
        return 4;
      case 'prime-found':
      case 'composite-skip':
        return 7;
      case 'strike':
        return 19;
      case 'sweep-done':
        return 10;
      case 'count-visit':
        return 12;
      case 'done':
        return 14;
    }
  },
};

export const sieve: AlgorithmDef = defineAlgorithm<SieveStep>({
  id: 'sieve-of-eratosthenes',
  title: 'Sieve of Eratosthenes',
  summary: 'Counts the primes below n by striking out the multiples of each prime.',
  idleText: 'Pick n and press Run.',
  refs: [
    { label: 'Wikipedia', href: 'https://en.wikipedia.org/wiki/Sieve_of_Eratosthenes' },
    {
      label: 'O(n log log n)',
      href: 'https://en.wikipedia.org/wiki/Sieve_of_Eratosthenes#Algorithmic_complexity',
    },
    { label: 'LeetCode 204', href: 'https://leetcode.com/problems/count-primes/' },
  ],
  controls: [{ id: 'n', label: 'n', min: 2, max: 120, default: 30 }],
  buildSteps(values: ControlValues): SieveStep[] {
    return buildSteps(values['n'] ?? 30);
  },
  delayFor(step: SieveStep): number {
    switch (step.kind) {
      case 'init':
        return 900;
      case 'strike-units':
        return 1000;
      case 'prime-found':
        return 1100;
      case 'composite-skip':
        return 700;
      case 'strike':
        return 380;
      case 'sweep-done':
        return 1300;
      case 'count-visit':
        return step.prime ? 480 : 160;
      case 'done':
        return 0;
    }
  },
  statusText(step: SieveStep): string {
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
  },
  chipFor(step: SieveStep) {
    if (step.kind === 'count-visit') return { text: `count = ${step.count}` };
    if (step.kind === 'done') return { text: `${step.count} primes below ${step.n}`, final: true };
    return null;
  },
  listings: [jsListing, pyListing, javaListing],
});
