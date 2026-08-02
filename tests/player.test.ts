import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../src/engine/player';

// Steps are opaque to the player; pacing arrives with load().
const strikes = (count: number): { value: number }[] =>
  Array.from({ length: count }, (_, k) => ({ value: k }));

const delay = (): number => 380;

const load = (player: Player, steps: readonly unknown[]): void => player.load(steps, delay);

describe('Player', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays every step to completion', () => {
    const player = new Player();
    const seen: unknown[] = [];
    player.onStep = (s): number => seen.push(s);
    load(player, strikes(5));
    player.play();
    vi.runAllTimers();
    expect(seen).toHaveLength(5);
    expect(player.state).toBe('done');
  });

  it('load() mid-run cancels the old run (the 2021 orphaned loop)', () => {
    const player = new Player();
    let applied = 0;
    player.onStep = () => applied++;
    load(player, strikes(50));
    player.play();
    vi.advanceTimersByTime(500);
    const beforeReload = applied;
    expect(player.state).toBe('running');

    load(player, strikes(3));
    vi.runAllTimers();
    // nothing from the first run may land after the reload
    expect(applied).toBe(beforeReload);

    player.play();
    vi.runAllTimers();
    expect(applied).toBe(beforeReload + 3);
    expect(player.state).toBe('done');
  });

  it('pause() stops the timer chain and play() resumes it', () => {
    const player = new Player();
    let applied = 0;
    player.onStep = () => applied++;
    load(player, strikes(10));
    player.play();
    vi.advanceTimersByTime(200);
    player.pause();
    const paused = applied;
    vi.advanceTimersByTime(5000);
    expect(applied).toBe(paused);
    player.play();
    vi.runAllTimers();
    expect(applied).toBe(10);
  });

  it('stepOnce() advances exactly one step and pauses playback', () => {
    const player = new Player();
    let applied = 0;
    player.onStep = () => applied++;
    load(player, strikes(10));
    player.stepOnce();
    expect(applied).toBe(1);
    expect(player.state).toBe('paused');
    vi.advanceTimersByTime(5000);
    expect(applied).toBe(1);
  });

  it('reaches done via stepping and further steps are no-ops', () => {
    const player = new Player();
    let applied = 0;
    player.onStep = () => applied++;
    load(player, strikes(2));
    player.stepOnce();
    player.stepOnce();
    expect(player.state).toBe('done');
    player.stepOnce();
    player.play();
    vi.runAllTimers();
    expect(applied).toBe(2);
  });
});
