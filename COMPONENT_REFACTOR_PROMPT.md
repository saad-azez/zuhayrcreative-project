# React Component Refactor Prompt (Reusable)

## কিভাবে Use করবে

এই prompt টা copy-paste করে `[COMPONENT_PATH]` replace করে দাও।

---

## The Prompt

````
Refactor [COMPONENT_PATH] fully. Rules:

## Architecture
1. **One concern per file** — no giant monolithic components
2. **Pure animation functions** — extract all GSAP timelines into separate `*-animations.ts` files (no inline `.to()/.fromTo()/.timeline()` in components)
3. **Shared utilities** — if any function (like `SplitType` initialization) appears in 2+ files, extract to a shared module
4. **Custom hooks for state machines** — animation state locks (`isAnimating`, `isOpen`) go in a dedicated `use[Name]State.ts` hook using `useRef` (NEVER `useState` for animation locks — stale closure risk)

## GSAP Best Practices
5. **`gsap.context()` in EVERY `useEffect`** — never create naked tweens/timelines. Always:
   ```ts
   useEffect(() => {
     const ctx = gsap.context(() => {
       // all tweens here
     }, scopeRef);
     return () => ctx.revert(); // scoped cleanup
   }, []);
````

6. **No global `ScrollTrigger.kill()` / `ScrollTrigger.refresh()`** — let `gsap.context()` handle cleanup
7. **Use `quickTo()` for pointer tracking** — no `requestAnimationFrame` loops for cursor/pointer. Use `gsap.quickTo(element, 'x')` and call in `onMouseMove`
8. **`.revert()` not `.kill()`** — when context unmounts, `revert()` cleans up inline styles too

## React Best Practices

9. **`React.memo()` on leaf components** — `ContentPanel`, `ImageCard`, `CustomCursor` etc
10. **No `useCallback` with empty deps that read reactive state** — use `useRef` for values read inside callbacks that shouldn't trigger re-creation
11. **No inline objects/arrays in JSX props** — extract to `useMemo` or module-level constants
12. **`useRef` for DOM nodes, `useState` for UI, `useRef` for mutable animation state**

## CSS

13. **Consolidate duplicate selectors** — one definition per selector
14. **`transform: translateZ(0)` or `will-change`** on animated elements for GPU layer promotion
15. **No `!important`** — fix specificity instead
16. **Use CSS logical properties** where possible (`inset`, `block-size`, `inline-size`)

## Output

- Zero TypeScript errors
- Zero ESLint warnings
- All imports sorted (react → gsap → local)
- Barrel export from `index.ts`

## Deliverables

1. List new files created with one-line purpose each
2. List refactored files with what changed
3. Before/after line count for the main component

```

---

## Optional Add-ons

### যদি component-এ scroll animations থাকে:
```

- Each ScrollTrigger gets its own `gsap.context()` or is grouped by concern
- Use `trigger` option (not `scroller`) unless cross-container scrolling
- `scrub: true` for smooth parallax, `scrub: 1` for text reveals

```

### যদি component-এ cursor follower থাকে:
```

- Use `gsap.quickTo()` paired with `onMouseMove` — no RAF
- `pointer-events: none` on cursor element
- `will-change: transform` on cursor element

```

### যদি component-এ SplitType থাকে:
```

- Extract to `splitText.ts` shared utility
- Call `split.revert()` in cleanup (or let GSAP context handle it)
- Wrap chars in `<span class='char'>` for per-character animation

```

```
