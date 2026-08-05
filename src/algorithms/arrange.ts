/**
 * The input arrays the sorting demos act on. Shared so that "shuffled",
 * "nearly sorted", and "reversed" mean exactly the same thing to every sort —
 * comparing two algorithms is only honest if they are handed the same rows.
 *
 * Every array is a pure function of (size, order), so a reload, a deep link,
 * or a screenshot always reproduces the run you just watched.
 */
import { mulberry32 } from './random';

/** Value band for the generated arrays; the ceiling leaves lifted marks headroom. */
const LOW = 8;
const HIGH = 92;

export const ORDER = { shuffled: 0, nearly: 1, reversed: 2 };

export const ORDER_OPTIONS = [
  { value: ORDER.shuffled, label: 'shuffled' },
  { value: ORDER.nearly, label: 'nearly sorted' },
  { value: ORDER.reversed, label: 'reversed' },
] as const;

export function orderLabel(order: number): string {
  return ORDER_OPTIONS.find((option) => option.value === order)?.label ?? 'shuffled';
}

/** `size` distinct values spread over LOW..HIGH, ascending. Seeded by size. */
function ramp(size: number): number[] {
  const rand = mulberry32(size * 0x85ebca6b + 13);
  const gap = (HIGH - LOW) / size;
  const out: number[] = [];
  let prev = LOW - 1;
  for (let i = 0; i < size; i++) {
    const center = LOW + (i + 0.5) * gap;
    const jittered = Math.round(center + (rand() - 0.5) * gap * 0.8);
    out.push(Math.max(prev + 1, Math.min(HIGH, jittered)));
    prev = out[i] ?? prev + 1;
  }
  return out;
}

function isAscending(values: readonly number[]): boolean {
  return values.every((v, i) => i === 0 || v > (values[i - 1] ?? -Infinity));
}

/** A handful of adjacent transpositions, spread out — insertion sort's best case. */
function nearlySorted(base: readonly number[]): number[] {
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

function shuffle(base: readonly number[], seed: number): number[] {
  const out = base.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  // A seeded shuffle can land on the sorted order; that would hide the algorithm.
  if (isAscending(out) && out.length > 1) {
    const first = out[0];
    const second = out[1];
    if (first !== undefined && second !== undefined) {
      out[0] = second;
      out[1] = first;
    }
  }
  return out;
}

/** The array to sort: deterministic per (size, order) so every run reproduces. */
export function arrangeValues(size: number, order: number): number[] {
  const base = ramp(size);
  if (order === ORDER.reversed) return base.reverse();
  if (order === ORDER.nearly) return nearlySorted(base);
  return shuffle(base, size * 0x27d4eb2d + 101);
}
