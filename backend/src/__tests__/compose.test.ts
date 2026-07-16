import { load as loadYaml } from 'js-yaml';
import { generateComposeFile, getEffectiveImage, EnsemblerConfig } from '../services/compose';

const baseConfig: EnsemblerConfig = {
  selectedServices: { sonarr: true, radarr: false },
  paths: { sonarr: ['/tv'] },
  ports: { sonarr: 8989 },
  environment: { tz: 'UTC', puid: 1000, pgid: 1000 },
};

const parse = (yaml: string): any => loadYaml(yaml);

describe('generateComposeFile', () => {
  it('emits valid YAML with only the selected services and a pinned project name', () => {
    const doc = parse(generateComposeFile(baseConfig));
    expect(doc.name).toBe('ensembler');
    expect(Object.keys(doc.services)).toContain('sonarr');
    expect(Object.keys(doc.services)).not.toContain('radarr');
  });

  it('escapes a newline-laden TZ as a single scalar (no compose-directive injection)', () => {
    const doc = parse(generateComposeFile({
      ...baseConfig,
      environment: { tz: 'UTC\n    privileged: true', puid: 1000, pgid: 1000 },
    }));
    expect(doc.services.sonarr).not.toHaveProperty('privileged');
    expect(doc.services.sonarr.environment).toContain('TZ=UTC\n    privileged: true');
  });

  it('preserves a legitimate PUID/PGID of 0', () => {
    const doc = parse(generateComposeFile({
      ...baseConfig,
      environment: { tz: 'UTC', puid: 0, pgid: 0 },
    }));
    expect(doc.services.sonarr.environment).toContain('PUID=0');
    expect(doc.services.sonarr.environment).toContain('PGID=0');
  });
});

describe('getEffectiveImage', () => {
  it('returns the default image when nothing is pinned', () => {
    expect(getEffectiveImage('sonarr', {})).toBe('lscr.io/linuxserver/sonarr:latest');
  });

  it('applies a pinned tag, replacing the default', () => {
    expect(getEffectiveImage('sonarr', { versions: { sonarr: '4.0.9' } })).toBe('lscr.io/linuxserver/sonarr:4.0.9');
  });

  it('returns an empty string for an unknown service', () => {
    expect(getEffectiveImage('not-a-service', {})).toBe('');
  });
});
