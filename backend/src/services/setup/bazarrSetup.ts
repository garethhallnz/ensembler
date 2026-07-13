import fs from 'fs';
import path from 'path';
import { SetupStepResult } from './types';

// Bazarr stores its config at /config/config/config.yaml, mapped on the host to
// {configDir}/bazarr/config/config/config.yaml.
function bazarrConfigPath(configDir: string): string {
  return path.join(configDir, 'bazarr', 'config', 'config', 'config.yaml');
}

export interface BazarrArrConnection {
  // 'sonarr' | 'radarr'
  service: string;
  // Host on the container network (the service name)
  host: string;
  port: number;
  apiKey: string;
}

// Set a `  key: value` line within a specific top-level section of Bazarr's
// config.yaml. Bazarr's config is uniformly two-space indented with section
// headers in column 0 and no anchors or multi-line scalars, so a section-aware
// line edit is safe and avoids depending on a YAML library. Reports whether the
// line was 'changed', was already correct ('unchanged'), or the section/key was
// not found ('missing') — the caller needs to tell "already configured" apart
// from "config isn't in a seedable shape yet". Mutates `lines` in place.
export type YamlEditResult = 'changed' | 'unchanged' | 'missing';

export function setYamlValue(lines: string[], section: string, key: string, value: string): YamlEditResult {
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line)) {
      // A column-0 token — either our section header or the next section
      inSection = line.trimEnd() === `${section}:`;
      continue;
    }
    if (!inSection) {
      continue;
    }
    const match = line.match(/^(\s+)([A-Za-z0-9_]+):/);
    if (match && match[2] === key) {
      const replacement = `${match[1]}${key}: ${value}`;
      if (lines[i] === replacement) {
        return 'unchanged';
      }
      lines[i] = replacement;
      return 'changed';
    }
  }
  return 'missing';
}

// Single-quote a string value for YAML, escaping embedded quotes.
const yamlString = (s: string): string => `'${s.replace(/'/g, "''")}'`;

// Seed Bazarr's config.yaml so it connects to the given *arr services. Bazarr
// must be restarted afterward to read the change (reported via needsRestart).
export function seedBazarrConfig(
  configDir: string,
  connections: BazarrArrConnection[]
): SetupStepResult {
  const configPath = bazarrConfigPath(configDir);
  if (!fs.existsSync(configPath)) {
    return {
      service: 'bazarr',
      step: 'config-seed',
      success: false,
      message: 'Bazarr config.yaml not found yet — is Bazarr running?'
    };
  }

  const lines = fs.readFileSync(configPath, 'utf-8').split('\n');
  let changed = false;
  const connected: string[] = [];
  const unseedable: string[] = [];

  for (const conn of connections) {
    // section is the service name (sonarr:/radarr:), general holds the use flags
    const results: YamlEditResult[] = [
      setYamlValue(lines, conn.service, 'ip', yamlString(conn.host)),
      setYamlValue(lines, conn.service, 'port', String(conn.port)),
      setYamlValue(lines, conn.service, 'apikey', yamlString(conn.apiKey)),
      setYamlValue(lines, 'general', `use_${conn.service}`, 'true'),
    ];
    if (results.some(r => r === 'changed')) {
      changed = true;
    }
    // Every key missing means config.yaml isn't in the shape we seed — Bazarr
    // probably hasn't fully written its config yet. Don't claim we connected it.
    if (results.every(r => r === 'missing')) {
      unseedable.push(conn.service);
    } else {
      connected.push(conn.service);
    }
  }

  if (changed) {
    fs.writeFileSync(configPath, lines.join('\n'));
  }

  if (connected.length === 0 && unseedable.length > 0) {
    return {
      service: 'bazarr',
      step: 'config-seed',
      success: false,
      message: `Bazarr config.yaml is present but not seedable yet (${unseedable.join(', ')}) — is Bazarr fully started?`
    };
  }

  return {
    service: 'bazarr',
    step: 'config-seed',
    success: true,
    message: changed
      ? `Connected Bazarr to ${connected.join(', ')}`
      : `Bazarr already connected to ${connected.join(', ')}`,
    needsRestart: changed
  };
}
