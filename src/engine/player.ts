import type { Step } from '../algorithms/types';

export type PlayerState = 'idle' | 'running' | 'paused' | 'done';

/** Base delay after a step, in ms at 1x speed. */
function delayFor(step: Step): number {
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
}

/**
 * Plays a precomputed step list on a single timer chain.
 *
 * Every scheduled tick captures the epoch at schedule time and bails if a
 * load() has bumped it since, so a reset or a new run can never race a
 * previous run — the failure mode of the 2021 version.
 */
export class Player {
  private steps: Step[] = [];
  private pos = 0;
  private epoch = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _state: PlayerState = 'idle';

  speed = 1;
  onStep: (step: Step) => void = () => undefined;
  onState: (state: PlayerState) => void = () => undefined;

  get state(): PlayerState {
    return this._state;
  }

  private setState(next: PlayerState): void {
    if (this._state === next) return;
    this._state = next;
    this.onState(next);
  }

  load(steps: Step[]): void {
    this.epoch++;
    this.clearTimer();
    this.steps = steps;
    this.pos = 0;
    this.setState('idle');
  }

  play(): void {
    if (this._state === 'running' || this._state === 'done') return;
    if (this.pos >= this.steps.length) return;
    this.setState('running');
    this.tick(this.epoch);
  }

  pause(): void {
    if (this._state !== 'running') return;
    this.clearTimer();
    this.setState('paused');
  }

  /** Apply exactly one step; pauses a running playback first. */
  stepOnce(): void {
    if (this._state === 'done') return;
    if (this.pos >= this.steps.length) return;
    this.clearTimer();
    if (!this.advance()) this.setState('paused');
  }

  private tick(epoch: number): void {
    if (epoch !== this.epoch) return;
    const step = this.steps[this.pos];
    if (step === undefined) return;
    if (this.advance()) return;
    const wait = Math.max(16, delayFor(step) / this.speed);
    this.timer = setTimeout(() => this.tick(epoch), wait);
  }

  /** Applies the next step. Returns true when the run just finished. */
  private advance(): boolean {
    const step = this.steps[this.pos];
    if (step === undefined) return true;
    this.pos++;
    this.onStep(step);
    if (this.pos >= this.steps.length) {
      this.clearTimer();
      this.setState('done');
      return true;
    }
    return false;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
