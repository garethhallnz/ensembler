import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from 'vitest-browser-react';
// Initialise i18n so component tests render real (English) copy.
import '../i18n/config';

// Unmount between tests so rendered DOM doesn't accumulate across cases.
afterEach(() => {
  cleanup();
});
