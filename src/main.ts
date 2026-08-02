import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import './styles.css';

import { algorithms } from './algorithms';
import { Player } from './engine/player';
import { Grid } from './ui/grid';
import { CodePanel } from './ui/code-panel';
import { statusText } from './ui/status';
import { initTheme } from './theme';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`missing #${id}`);
  return node as T;
}

function mustGet<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(what);
  return value;
}

initTheme();

const algo = mustGet(algorithms[0], 'no algorithms registered');
const listing = mustGet(algo.listings[0], 'algorithm has no code listing');

const controls = el<HTMLFormElement>('controls');
const numInput = el<HTMLInputElement>('numInput');
const runBtn = el<HTMLButtonElement>('runBtn');
const stepBtn = el<HTMLButtonElement>('stepBtn');
const resetBtn = el<HTMLButtonElement>('resetBtn');
const speedSelect = el<HTMLSelectElement>('speedSelect');
const status = el<HTMLElement>('status');
const countChip = el<HTMLElement>('countChip');
const picker = el<HTMLSelectElement>('algoPicker');

// The registry is the source of truth for the picker and the page head.
picker.replaceChildren(
  ...algorithms.map(
    (entry, index) =>
      new Option(`${String(index + 1).padStart(2, '0')} · ${entry.title}`, entry.id),
  ),
);
picker.value = algo.id;
document.documentElement.dataset.algo = algo.id;
el('algoIndex').textContent = 'algorithm 01';
el('algoTitle').textContent = algo.title;
el('algoSummary').textContent = algo.summary;

const grid = new Grid(el('grid'));
const codePanel = new CodePanel(el('codeBlock'), el('codeLabel'));
const player = new Player();

codePanel.show(listing);
numInput.value = String(algo.input.default);
grid.build(algo.input.default);

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  speedSelect.value = '4';
  player.speed = 4;
}

player.onStep = (step) => {
  grid.apply(step);
  codePanel.apply(step);
  status.textContent = statusText(step);
  if (step.kind === 'count-visit') {
    countChip.hidden = false;
    countChip.textContent = `count = ${step.count}`;
  } else if (step.kind === 'done') {
    countChip.hidden = false;
    countChip.classList.add('final');
    countChip.textContent = `${step.count} primes below ${step.n}`;
  }
};

player.onState = (state) => {
  runBtn.textContent = state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : 'Run';
  stepBtn.disabled = state === 'done';
};

function readInput(): number | null {
  const raw = numInput.value.trim();
  const value = Number(raw);
  if (raw === '' || !Number.isInteger(value) || value < algo.input.min || value > algo.input.max) {
    status.textContent = `n must be a whole number from ${algo.input.min} to ${algo.input.max}.`;
    numInput.focus();
    return null;
  }
  return value;
}

function hideChip(): void {
  countChip.hidden = true;
  countChip.classList.remove('final');
}

/** n for the idle preview grid: the input if valid, else the default. */
function previewN(): number {
  const value = Number(numInput.value.trim());
  return Number.isInteger(value) && value >= algo.input.min && value <= algo.input.max
    ? value
    : algo.input.default;
}

function startRun(n: number): void {
  hideChip();
  player.load(algo.buildSteps(n));
  player.play();
}

controls.addEventListener('submit', (e) => {
  e.preventDefault();
  if (player.state === 'running') {
    player.pause();
    return;
  }
  if (player.state === 'paused') {
    player.play();
    return;
  }
  const n = readInput();
  if (n !== null) startRun(n);
});

stepBtn.addEventListener('click', () => {
  if (player.state === 'idle') {
    const n = readInput();
    if (n === null) return;
    hideChip();
    player.load(algo.buildSteps(n));
  }
  player.stepOnce();
});

resetBtn.addEventListener('click', () => {
  player.load([]);
  grid.build(previewN());
  codePanel.setActiveLine(null);
  hideChip();
  status.textContent = 'Pick n and press Run.';
});

// A new n takes effect on the next Run — never mid-flight.
numInput.addEventListener('input', () => {
  if (player.state !== 'idle') {
    status.textContent = 'New n applies on the next Run (Reset first).';
    return;
  }
  const value = Number(numInput.value.trim());
  if (Number.isInteger(value) && value >= algo.input.min && value <= algo.input.max) {
    grid.build(value);
  }
});

speedSelect.addEventListener('change', () => {
  player.speed = Number(speedSelect.value);
});

// Keep the cursor ring seated when a resize reflows the grid.
let relayoutQueued = false;
window.addEventListener('resize', () => {
  if (relayoutQueued) return;
  relayoutQueued = true;
  requestAnimationFrame(() => {
    relayoutQueued = false;
    grid.relayout();
  });
});
