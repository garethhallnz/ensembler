import { isNewerVersion } from './services/appUpdate';

describe('isNewerVersion', () => {
  it('detects a newer release', () => {
    expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true);
  });

  it('tolerates a leading v', () => {
    expect(isNewerVersion('v1.1.0', '1.0.0')).toBe(true);
  });

  it('is false for equal versions', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
  });

  it('is false for older releases', () => {
    expect(isNewerVersion('1.0.0', '1.2.0')).toBe(false);
  });

  it('compares numerically, not lexically', () => {
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
  });

  it('ignores pre-release suffixes', () => {
    expect(isNewerVersion('1.2.0-rc.1', '1.1.0')).toBe(true);
  });

  it('handles differing segment counts', () => {
    expect(isNewerVersion('1.1', '1.0.5')).toBe(true);
    expect(isNewerVersion('1.0', '1.0.0')).toBe(false);
  });
});
