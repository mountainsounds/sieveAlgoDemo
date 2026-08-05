import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import './styles.css';

import type {
  AlgorithmView,
  ChoiceControl,
  Control,
  ControlValues,
  NumberControl,
} from './algorithms/types';
import { isChoice } from './algorithms/types';
import { registry, type AlgorithmEntry } from './registry';
import { Player } from './engine/player';
import { CodePanel } from './ui/code-panel';
import { AlgoPicker } from './ui/picker';
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

const controls = el<HTMLFormElement>('controls');
const controlFields = el<HTMLElement>('controlFields');
const runBtn = el<HTMLButtonElement>('runBtn');
const stepBtn = el<HTMLButtonElement>('stepBtn');
const resetBtn = el<HTMLButtonElement>('resetBtn');
const speedSelect = el<HTMLSelectElement>('speedSelect');
const status = el<HTMLElement>('status');
const countChip = el<HTMLElement>('countChip');
const stage = el<HTMLElement>('stage');
const refsNav = el<HTMLElement>('algoRefs');

const codePanel = new CodePanel(el('codeBlock'), el('codeLabel'));
const player = new Player();

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  speedSelect.value = '4';
  player.speed = 4;
}

/** URL path ↔ algorithm id. `/` means the first algorithm in the registry. */
function entryForPath(pathname: string): AlgorithmEntry | null {
  const slug = pathname.replace(/^\/+|\/+$/g, '');
  if (slug === '') return registry[0] ?? null;
  return registry.find((candidate) => candidate.def.id === slug) ?? null;
}

let entry = mustGet(registry[0], 'no algorithms registered');
let view: AlgorithmView | null = null;

/** A rendered control: the spec it came from and the element holding its value. */
type Field =
  | { kind: 'number'; spec: NumberControl; input: HTMLInputElement }
  | { kind: 'choice'; spec: ChoiceControl; input: HTMLSelectElement };

let fields: Field[] = [];

function fieldLabel(spec: Control, text: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'panel-label';
  label.htmlFor = `ctl-${spec.id}`;
  label.textContent = text;
  return label;
}

function numberField(spec: NumberControl): Field {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const input = document.createElement('input');
  input.id = `ctl-${spec.id}`;
  input.name = spec.id;
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.step = '1';
  input.value = String(spec.default);
  const field: Field = { kind: 'number', spec, input };
  input.addEventListener('input', () => onFieldInput(field));
  wrap.append(fieldLabel(spec, `${spec.label} (${spec.min}–${spec.max})`), input);
  controlFields.appendChild(wrap);
  return field;
}

function choiceField(spec: ChoiceControl): Field {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const input = document.createElement('select');
  input.id = `ctl-${spec.id}`;
  input.name = spec.id;
  for (const option of spec.options) {
    const node = document.createElement('option');
    node.value = String(option.value);
    node.textContent = option.label;
    node.selected = option.value === spec.default;
    input.appendChild(node);
  }
  const field: Field = { kind: 'choice', spec, input };
  input.addEventListener('change', () => onFieldInput(field));
  wrap.append(fieldLabel(spec, spec.label), input);
  controlFields.appendChild(wrap);
  return field;
}

function renderControls(specs: readonly Control[]): void {
  controlFields.textContent = '';
  fields = specs.map((spec) => (isChoice(spec) ? choiceField(spec) : numberField(spec)));
}

function parseField(field: Field): number | null {
  const value = Number(field.input.value.trim());
  if (field.kind === 'choice') {
    return field.spec.options.some((option) => option.value === value) ? value : null;
  }
  const { spec, input } = field;
  if (input.value.trim() === '' || !Number.isInteger(value)) return null;
  return value < spec.min || value > spec.max ? null : value;
}

/** Every control's value, or null after reporting the first invalid one. */
function readInputs(): ControlValues | null {
  const values: Record<string, number> = {};
  for (const field of fields) {
    const value = parseField(field);
    if (value === null) {
      status.textContent =
        field.kind === 'number'
          ? `${field.spec.label} must be a whole number from ${field.spec.min} to ${field.spec.max}.`
          : `Pick ${field.spec.label} from the list.`;
      field.input.focus();
      return null;
    }
    values[field.spec.id] = value;
  }
  return values;
}

/** Values for the idle preview: each field if valid, else its default. */
function previewValues(): ControlValues {
  const values: Record<string, number> = {};
  for (const field of fields) {
    values[field.spec.id] = parseField(field) ?? field.spec.default;
  }
  return values;
}

function onFieldInput(field: Field): void {
  if (player.state !== 'idle') {
    status.textContent = `New ${field.spec.label} applies on the next Run (Reset first).`;
    return;
  }
  if (parseField(field) !== null) view?.preview(previewValues());
}

function hideChip(): void {
  countChip.hidden = true;
  countChip.classList.remove('final');
}

function mount(next: AlgorithmEntry): void {
  entry = next;
  const def = next.def;
  const index = String(registry.indexOf(next) + 1).padStart(2, '0');
  document.documentElement.dataset.algo = def.id;
  document.title = `${def.title} · algo.`;
  el('algoIndex').textContent = `algorithm ${index}`;
  el('algoTitle').textContent = def.title;
  el('algoSummary').textContent = def.summary;
  refsNav.textContent = '';
  for (const ref of def.refs) {
    const link = document.createElement('a');
    link.href = ref.href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = ref.label;
    refsNav.appendChild(link);
  }
  renderControls(def.controls);
  codePanel.show(mustGet(def.listings[0], 'algorithm has no code listing'));
  view = next.createView(stage);
  view.preview(previewValues());
  hideChip();
  status.textContent = def.idleText;
}

function unmount(): void {
  player.load([], () => 0);
  view?.destroy();
  view = null;
  codePanel.setActiveLine(null);
}

function switchTo(next: AlgorithmEntry, push: boolean): void {
  if (next === entry && view !== null) return;
  unmount();
  mount(next);
  picker.select(next.def.id);
  if (push) history.pushState(null, '', `/${next.def.id}`);
}

const picker = new AlgoPicker(
  el('algoPicker'),
  registry.map((candidate) => candidate.def),
  (entryForPath(location.pathname) ?? entry).def.id,
  (id) => {
    const next = registry.find((candidate) => candidate.def.id === id);
    if (next !== undefined) switchTo(next, true);
  },
);

window.addEventListener('popstate', () => {
  const next = entryForPath(location.pathname);
  if (next !== null) switchTo(next, false);
});

player.onStep = (step) => {
  view?.apply(step);
  codePanel.apply(step);
  status.textContent = entry.def.statusText(step);
  const chip = entry.def.chipFor(step);
  if (chip !== null) {
    countChip.hidden = false;
    countChip.classList.toggle('final', chip.final === true);
    countChip.textContent = chip.text;
  }
};

player.onState = (state) => {
  runBtn.textContent = state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : 'Run';
  stepBtn.disabled = state === 'done';
};

function startRun(values: ControlValues): void {
  hideChip();
  const def = entry.def;
  player.load(def.buildSteps(values), (step) => def.delayFor(step));
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
  const values = readInputs();
  if (values !== null) startRun(values);
});

stepBtn.addEventListener('click', () => {
  if (player.state === 'idle') {
    const values = readInputs();
    if (values === null) return;
    hideChip();
    const def = entry.def;
    player.load(def.buildSteps(values), (step) => def.delayFor(step));
  }
  player.stepOnce();
});

resetBtn.addEventListener('click', () => {
  player.load([], () => 0);
  view?.preview(previewValues());
  codePanel.setActiveLine(null);
  hideChip();
  status.textContent = entry.def.idleText;
});

speedSelect.addEventListener('change', () => {
  player.speed = Number(speedSelect.value);
});

// Keep absolutely positioned markers seated when a resize reflows the stage.
let relayoutQueued = false;
window.addEventListener('resize', () => {
  if (relayoutQueued) return;
  relayoutQueued = true;
  requestAnimationFrame(() => {
    relayoutQueued = false;
    view?.relayout();
  });
});

// Boot: honor a deep link; normalize unknown paths back to the root.
const initial = entryForPath(location.pathname);
if (initial === null) history.replaceState(null, '', '/');
mount(initial ?? entry);
