# algo.

Animated algorithm walkthroughs. Each algorithm gets its own animated
visual, a plain-language narration line, and a code panel that follows the
executing line. So far: 01 Sieve of Eratosthenes, 02 Binary Search.

Two themes, switchable in the header: Signal (dark) and Notebook (light
graph paper).

Live: https://algo.mtnsounds.com/

Built with Vite + TypeScript, no framework. Each algorithm is a pure
function that emits a list of steps; a small player applies them to that
algorithm's view and the code panel, so runs can be paused, stepped, and
reset safely. Originally a 2021 vanilla JS demo, rebuilt in 2026.

## Develop

```
npm install
npm run dev
```

`npm run lint`, `npm test`, and `npm run build` are the gates CI runs.
