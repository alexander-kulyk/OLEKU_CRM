// Registers jest-dom's DOM matchers (toBeInTheDocument, toHaveAccessibleName,
// etc.) on Vitest's `expect`, for every jsdom test in this package.
import '@testing-library/jest-dom/vitest'

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// React Testing Library only auto-registers this via a global `afterEach`,
// which Vitest does not expose without `test.globals: true` (not set here —
// see vitest.config.ts). Without it, a component rendered by one test stays
// mounted in `document.body` for every test that runs after it in the same
// file, corrupting `screen` queries.
afterEach(() => {
  cleanup()
})
