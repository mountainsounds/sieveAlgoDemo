/**
 * Soft-wrapping for one line of code on a panel too narrow to show it whole.
 *
 * A browser wraps at the last space that fits, which knows nothing about code:
 * it splits `2 * width`, strands a `{` on its own row, and leaves `i);` hanging
 * after a call. This picks the breaks a person would. Every place a row could
 * end gets a cost for how badly it splits the code, every extra row costs a
 * little too, and the line takes the cheapest layout, then the one with fewer
 * rows, then the one with the fullest first row.
 */

/** What one more row costs, so a clean third row can beat an ugly second. */
const ROW_COST = 3;

/** What a last row of a few characters costs: `i);` reads like a mistake. */
const STUB_COST = 4;

/** A place a row can end: the row stops at `end`, the next starts at `next`. */
interface Break {
  end: number;
  next: number;
  cost: number;
}

interface Layout {
  rows: number;
  cost: number;
  points: number[];
}

/** Leading spaces on one line of a listing. */
export function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * How many columns past its own indentation a wrapped row starts: two indent
 * steps, so 4 in JavaScript and Java and 8 in Python. One step would put the
 * wrapped row level with the next nested line and read as a new line.
 */
export function hangFor(code: string): number {
  const indents = code
    .split('\n')
    .map(indentOf)
    .filter((indent) => indent > 0);
  return indents.length === 0 ? 4 : 2 * Math.min(...indents);
}

/**
 * Offsets where each wrapped row of `line` starts, so that no row is wider
 * than `cols`. Wrapped rows hang `hang` columns past the line's own
 * indentation, so they have that much less room. An empty result means the
 * line fits as it is.
 */
export function wrapPoints(line: string, cols: number, hang: number): number[] {
  if (line.length <= cols) return [];
  const indent = indentOf(line);
  const wrappedRoom = cols - indent - hang;
  if (wrappedRoom < 1) return [];

  const breaks = breaksIn(line, indent);
  const memo = new Map<number, Layout>();

  const layout = (start: number): Layout => {
    const known = memo.get(start);
    if (known !== undefined) return known;
    const room = start === 0 ? cols : wrappedRoom;
    let best: Layout | null = null;
    let bestEnd = -1;

    if (line.length - start <= room) {
      best = { rows: 1, cost: 0, points: [] };
    } else {
      for (const option of breaks) {
        if (option.next <= start || option.end - start > room) continue;
        if (start === 0 && option.end <= indent) continue;
        const rest = layout(option.next);
        let cost = option.cost + ROW_COST + rest.cost;
        if (rest.rows === 1 && line.length - option.next < wrappedRoom / 4) cost += STUB_COST;
        const candidate = { rows: rest.rows + 1, cost, points: [option.next, ...rest.points] };
        if (best === null || better(candidate, option.end, best, bestEnd)) {
          best = candidate;
          bestEnd = option.end;
        }
      }
    }

    if (best === null) {
      // No break fits at all: cut the token at the edge.
      const cut = start + room;
      const rest = layout(cut);
      best = {
        rows: rest.rows + 1,
        cost: 20 + ROW_COST + rest.cost,
        points: [cut, ...rest.points],
      };
    }
    memo.set(start, best);
    return best;
  };

  return layout(0).points;
}

function better(a: Layout, aEnd: number, b: Layout, bEnd: number): boolean {
  if (a.cost !== b.cost) return a.cost < b.cost;
  if (a.rows !== b.rows) return a.rows < b.rows;
  return aEnd > bEnd;
}

/** Every place a row of `line` could end, cheapest where people break code. */
function breaksIn(line: string, indent: number): Break[] {
  const breaks: Break[] = [];
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '(' || char === '[') depth++;
    if (char === ')' || char === ']') depth--;

    if (char === '(' && i > indent && i + 1 < line.length && line[i + 1] !== ')') {
      breaks.push({ end: i + 1, next: i + 1, cost: 3 + depth });
    }
    if (char === ' ' && i > indent && line[i - 1] !== ' ') {
      let next = i;
      while (line[next] === ' ') next++;
      breaks.push({ end: i, next, cost: spaceCost(line.slice(0, i), line.slice(next), depth) });
    }
  }
  return breaks;
}

/**
 * How badly a break at this space splits the code around it. Cheapest: after
 * the test of a one-line if or while. Then between arguments or clauses,
 * before a logical operator, and after an assignment. Dearest: inside an
 * expression, the deeper the worse, and anything that strands a brace.
 */
function spaceCost(before: string, after: string, depth: number): number {
  if (after.startsWith('{')) return 9;
  if (before.endsWith(')') && depth === 0 && /^\w/.test(after)) return 0;
  // Between arguments or clauses is a clean break. Outside any brackets a
  // comma separates the items of a tuple, and the = beside it splits better.
  if (before.endsWith(',') || before.endsWith(';')) return depth === 0 ? 3 : depth;
  if (/^(&&|\|\||and |or )/.test(after)) return 2;
  if (/(^|[^=!<>])[-+*/]?=$/.test(before)) return 2;
  if (/^[-+*/%] /.test(after)) return 3 + 2 * depth;
  return 5 + 2 * depth;
}
