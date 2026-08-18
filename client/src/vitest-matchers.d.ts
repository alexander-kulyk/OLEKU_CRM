// Makes jest-dom's Vitest matchers (`toBeInTheDocument`, `toHaveFocus`,
// `toBeDisabled`, etc. — registered at runtime by `vitest.setup.ts`) visible
// to `tsc -b`'s type-check of `src/**/*.test.tsx`. `vitest.setup.ts` lives
// outside this project's `include` (`tsconfig.app.json` only includes
// `src`), so its side-effecting import alone does not carry the ambient
// `vitest` module augmentation into this compilation.
/// <reference types="@testing-library/jest-dom/vitest" />
