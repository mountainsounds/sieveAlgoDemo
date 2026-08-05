import type { AlgorithmDef, AlgorithmView } from './algorithms/types';
import { sieve } from './algorithms/sieve';
import { binarySearchAlgo } from './algorithms/binary-search';
import { insertionSortAlgo } from './algorithms/insertion-sort';
import { SieveView } from './ui/views/sieve-view';
import { SearchView } from './ui/views/search-view';
import { SortView } from './ui/views/sort-view';

/** An algorithm plus the view that renders it. Order fixes the 01/02 numbering. */
export interface AlgorithmEntry {
  def: AlgorithmDef;
  createView(stage: HTMLElement): AlgorithmView;
}

export const registry: readonly AlgorithmEntry[] = [
  { def: sieve, createView: (stage) => new SieveView(stage) },
  { def: binarySearchAlgo, createView: (stage) => new SearchView(stage) },
  { def: insertionSortAlgo, createView: (stage) => new SortView(stage) },
];
