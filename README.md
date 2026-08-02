# algo.

Animated algorithm walkthroughs. Each algorithm gets an animated grid, a
plain-language narration line, and a code panel that follows the executing
line. First up: the Sieve of Eratosthenes.

Two themes, switchable in the header: Signal (dark) and Notebook (light
graph paper).

Live: https://mountainsounds.github.io/sieveAlgoDemo/

Built with Vite + TypeScript, no framework. The algorithm is a pure function
that emits a list of steps; a small player applies them to the grid and the
code panel, so runs can be paused, stepped, and reset safely. Originally a
2021 vanilla JS demo, rebuilt in 2026.

## Develop

```
npm install
npm run dev
```

`npm run lint`, `npm test`, and `npm run build` are the gates CI runs.
