/// <reference types="vite/client" />

// Minimal JSX declaration so TypeScript recognizes JSX without requiring additional global changes.
// This is intentionally permissive; installing `@types/react` is still recommended for full typing.
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
