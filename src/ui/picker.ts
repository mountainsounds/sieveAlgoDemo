import type { AlgorithmDef } from '../algorithms/types';

/**
 * Algorithm picker: a select-only combobox (APG pattern). Focus stays on the
 * button; aria-activedescendant tracks the highlighted option. Options come
 * from the registry, so new algorithms appear without touching this file.
 */
export class AlgoPicker {
  private root: HTMLElement;
  private btn: HTMLButtonElement;
  private valueEl: HTMLElement;
  private list: HTMLElement;
  private items: HTMLElement[] = [];
  private ids: string[] = [];
  private labels: string[] = [];
  private selected = 0;
  private active = 0;
  private isOpen = false;

  constructor(
    root: HTMLElement,
    entries: readonly AlgorithmDef[],
    selectedId: string,
    private onSelect: (id: string) => void,
  ) {
    this.root = root;
    this.btn = must(root.querySelector<HTMLButtonElement>('.picker-btn'), 'picker button');
    this.valueEl = must(root.querySelector<HTMLElement>('#pickerValue'), 'picker value');
    this.list = must(root.querySelector<HTMLElement>('.picker-list'), 'picker list');

    this.ids = entries.map((entry) => entry.id);
    this.list.textContent = '';
    entries.forEach((entry, index) => {
      const number = String(index + 1).padStart(2, '0');
      this.labels.push(`${number} · ${entry.title}`);
      const item = document.createElement('li');
      item.id = `picker-opt-${index}`;
      item.setAttribute('role', 'option');
      const num = document.createElement('span');
      num.className = 'opt-index';
      num.textContent = number;
      const title = document.createElement('span');
      title.textContent = entry.title;
      item.append(num, title);
      this.list.appendChild(item);
      this.items.push(item);
    });

    this.selected = Math.max(0, this.ids.indexOf(selectedId));
    this.syncSelected();

    this.btn.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
    this.btn.addEventListener('keydown', (e) => this.onKeydown(e));
    // Keep focus on the button while clicking options.
    this.list.addEventListener('mousedown', (e) => e.preventDefault());
    this.list.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('[role="option"]');
      if (item === null) return;
      this.setActive(this.items.indexOf(item));
      this.commitActive();
    });
    this.list.addEventListener('mouseover', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('[role="option"]');
      if (item !== null) this.setActive(this.items.indexOf(item));
    });
    document.addEventListener('pointerdown', (e) => {
      if (this.isOpen && !this.root.contains(e.target as Node)) this.close();
    });
    this.btn.addEventListener('blur', () => this.close());
  }

  private onKeydown(e: KeyboardEvent): void {
    const open = this.isOpen;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (open) this.setActive(Math.min(this.active + 1, this.items.length - 1));
        else this.open();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) this.setActive(Math.max(this.active - 1, 0));
        else this.open();
        break;
      case 'Home':
        if (!open) return;
        e.preventDefault();
        this.setActive(0);
        break;
      case 'End':
        if (!open) return;
        e.preventDefault();
        this.setActive(this.items.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) this.commitActive();
        else this.open();
        break;
      case 'Escape':
        if (!open) return;
        e.preventDefault();
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  private open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.list.hidden = false;
    this.root.classList.add('open');
    this.btn.setAttribute('aria-expanded', 'true');
    this.setActive(this.selected);
  }

  private close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.list.hidden = true;
    this.root.classList.remove('open');
    this.btn.setAttribute('aria-expanded', 'false');
    this.btn.removeAttribute('aria-activedescendant');
  }

  private setActive(index: number): void {
    this.active = index;
    this.items.forEach((item, i) => item.classList.toggle('active', i === index));
    const id = this.items[index]?.id;
    if (id !== undefined) this.btn.setAttribute('aria-activedescendant', id);
  }

  private commitActive(): void {
    const changed = this.active !== this.selected;
    this.selected = this.active;
    this.syncSelected();
    this.close();
    const id = this.ids[this.selected];
    if (changed && id !== undefined) this.onSelect(id);
  }

  private syncSelected(): void {
    this.items.forEach((item, i) =>
      item.setAttribute('aria-selected', i === this.selected ? 'true' : 'false'),
    );
    this.valueEl.textContent = this.labels[this.selected] ?? '';
  }
}

function must<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`missing ${what}`);
  return value;
}
