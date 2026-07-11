import { getDefaultPath } from './pathDefaults';

describe('getDefaultPath', () => {
  it('maps common media fields to sensible home-relative defaults', () => {
    expect(getDefaultPath('sonarr', 'TV Shows')).toBe('~/TV Shows');
    expect(getDefaultPath('radarr', 'Movies')).toBe('~/Movies');
    expect(getDefaultPath('transmission', 'Downloads')).toBe('~/Downloads');
  });

  it('always returns a non-empty path (an empty default breaks compose generation)', () => {
    expect(getDefaultPath('anything', 'Some Unknown Field').length).toBeGreaterThan(0);
    expect(getDefaultPath('prowlarr', '').length).toBeGreaterThan(0);
  });
});
