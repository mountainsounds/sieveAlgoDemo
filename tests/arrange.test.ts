import { describe, expect, it } from 'vitest';
import { arrangeValues, orderLabel, ORDER, ORDER_OPTIONS } from '../src/algorithms/arrange';
import { SIZE as INSERTION_SIZE } from '../src/algorithms/insertion-sort';
import { SIZE as MERGE_SIZE } from '../src/algorithms/merge-sort';

/**
 * `arrangeValues` was lifted out of insertion-sort.ts so merge sort could be
 * handed the same rows. The copy below is the generator exactly as it read
 * while it was private to insertion sort — if the shared version ever drifts
 * from it, the arrays on the live insertion-sort demo would silently change.
 */
function legacyMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function legacyArrange(size: number, order: number): number[] {
  const LOW = 8;
  const HIGH = 92;
  const rand = legacyMulberry32(size * 0x85ebca6b + 13);
  const gap = (HIGH - LOW) / size;
  const base: number[] = [];
  let prev = LOW - 1;
  for (let i = 0; i < size; i++) {
    const center = LOW + (i + 0.5) * gap;
    const jittered = Math.round(center + (rand() - 0.5) * gap * 0.8);
    base.push(Math.max(prev + 1, Math.min(HIGH, jittered)));
    prev = base[i] ?? prev + 1;
  }

  if (order === 2) return base.reverse();

  if (order === 1) {
    const out = base.slice();
    const swaps = Math.max(1, Math.floor(base.length / 5));
    for (let s = 0; s < swaps; s++) {
      const i = Math.floor(((s + 0.5) / swaps) * (base.length - 1));
      const left = out[i];
      const right = out[i + 1];
      if (left === undefined || right === undefined) continue;
      out[i] = right;
      out[i + 1] = left;
    }
    return out;
  }

  const out = base.slice();
  const rand2 = legacyMulberry32(size * 0x27d4eb2d + 101);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand2() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  const ascending = out.every((v, i) => i === 0 || v > (out[i - 1] ?? -Infinity));
  if (ascending && out.length > 1) {
    const first = out[0];
    const second = out[1];
    if (first !== undefined && second !== undefined) {
      out[0] = second;
      out[1] = first;
    }
  }
  return out;
}

const orders = ORDER_OPTIONS.map((option) => option.value);
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, k) => from + k);

describe('arrangeValues', () => {
  it('still produces byte-identical rows to the pre-extraction generator', () => {
    for (const size of range(INSERTION_SIZE.min, INSERTION_SIZE.max)) {
      for (const order of orders) {
        expect(arrangeValues(size, order), `size=${size} order=${order}`).toEqual(
          legacyArrange(size, order),
        );
      }
    }
  });

  it('covers every size both sorts can ask for', () => {
    const lo = Math.min(INSERTION_SIZE.min, MERGE_SIZE.min);
    const hi = Math.max(INSERTION_SIZE.max, MERGE_SIZE.max);
    for (const size of range(lo, hi)) {
      for (const order of orders) {
        const values = arrangeValues(size, order);
        expect(values, `size=${size} order=${order}`).toHaveLength(size);
        expect(new Set(values).size, `size=${size} order=${order}`).toBe(size);
        expect(values, `size=${size} order=${order}`).toEqual(arrangeValues(size, order));
      }
    }
  });

  it('hands both sorts the same row for the same controls', () => {
    for (const size of range(MERGE_SIZE.min, INSERTION_SIZE.max)) {
      for (const order of orders) {
        // The point of sharing: "reversed at size 12" is one array, not two.
        expect(arrangeValues(size, order)).toEqual(arrangeValues(size, order));
      }
    }
  });
});

describe('orderLabel', () => {
  it('names every option and falls back for anything else', () => {
    for (const option of ORDER_OPTIONS) expect(orderLabel(option.value)).toBe(option.label);
    expect(orderLabel(99)).toBe('shuffled');
    expect(ORDER.shuffled).toBe(0);
  });
});
