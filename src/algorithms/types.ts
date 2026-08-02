/** One visual moment in an algorithm run. The player applies these in order. */
export type Step =
  | { kind: 'init'; n: number }
  | { kind: 'strike-units' }
  | { kind: 'prime-found'; i: number }
  | { kind: 'composite-skip'; i: number }
  | { kind: 'strike'; value: number; factor: number; multiplier: number }
  | { kind: 'sweep-done' }
  | { kind: 'count-visit'; i: number; prime: boolean; count: number }
  | { kind: 'done'; count: number; n: number };

export interface CodeListing {
  language: string;
  label: string;
  code: string;
  /** 1-based line to highlight for a step, or null for no change. */
  lineFor(step: Step): number | null;
}

export interface AlgorithmDef {
  id: string;
  title: string;
  /** One plain sentence describing what the algorithm does. */
  summary: string;
  input: { min: number; max: number; default: number };
  buildSteps(n: number): Step[];
  /** Pure result, used by tests and the instant path. */
  result(n: number): number;
  listings: CodeListing[];
}
