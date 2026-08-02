/**
 * Each algorithm defines its own step union; the shell never looks inside a
 * step. It asks the algorithm that produced it for narration, pacing, chip
 * text, and code lines, and hands it to that algorithm's view. `AlgorithmSpec`
 * is the strongly-typed authoring shape; `defineAlgorithm` erases the step
 * type at the registry boundary.
 */

/** One numeric input field, rendered by the shell. */
export interface NumberControl {
  id: string;
  label: string;
  min: number;
  max: number;
  default: number;
}

/** Current value of every control, keyed by control id. */
export type ControlValues = Readonly<Record<string, number>>;

/** Text for the readout chip; `final` styles it as the end-of-run stamp. */
export interface ChipUpdate {
  text: string;
  final?: boolean;
}

export interface Ref {
  label: string;
  href: string;
}

export interface CodeListing<S = unknown> {
  language: string;
  label: string;
  code: string;
  /** 1-based line to highlight for a step, or null for no change. */
  lineFor(step: S): number | null;
}

export interface AlgorithmSpec<S> {
  id: string;
  title: string;
  /** One plain sentence describing what the algorithm does. */
  summary: string;
  /** Status line while idle, e.g. "Pick n and press Run." */
  idleText: string;
  refs: readonly Ref[];
  controls: readonly NumberControl[];
  buildSteps(values: ControlValues): readonly S[];
  /** Base delay after a step, in ms at 1x speed. */
  delayFor(step: S): number;
  /** Plain-language narration for each step. */
  statusText(step: S): string;
  /** Chip update for a step, or null to leave the chip alone. */
  chipFor(step: S): ChipUpdate | null;
  listings: readonly CodeListing<S>[];
}

/** An `AlgorithmSpec` with its step type erased — what the shell works with. */
export type AlgorithmDef = AlgorithmSpec<unknown>;

/**
 * Erases the per-algorithm step type. Sound in practice: the only steps ever
 * fed back into a def's methods are the ones its own buildSteps produced.
 */
export function defineAlgorithm<S>(spec: AlgorithmSpec<S>): AlgorithmDef {
  return spec as AlgorithmDef;
}

/** Renders one algorithm into the stage element and applies its steps. */
export interface AlgorithmView {
  /** Idle preview for the given control values. */
  preview(values: ControlValues): void;
  apply(step: unknown): void;
  /** Re-seat any absolutely positioned markers after a resize. */
  relayout(): void;
  /** Empty the stage so another view can take it over. */
  destroy(): void;
}
