import type { TFunction } from 'i18next';

export interface ApiMessage {
  code?: string;
  message?: string;
  params?: Record<string, unknown>;
}

// Backend responses carry a stable `code` (+ optional params) alongside an
// English `message`. Render the code in the user's language, falling back to the
// English message when there's no code (or the key is missing). This keeps the
// backend language-agnostic while the user always sees their own language.
export const apiMessage = (t: TFunction, resp: ApiMessage | null | undefined): string => {
  if (!resp) return '';
  if (resp.code) return t(resp.code, { defaultValue: resp.message ?? '', ...(resp.params ?? {}) });
  return resp.message ?? '';
};
