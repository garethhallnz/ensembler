export interface SetupStepResult {
  service: string;
  step: string;
  success: boolean;
  message: string;
  // Set when a step mutated on-disk state that needs a container restart to
  // take effect (e.g. seeding Bazarr's config.yaml).
  needsRestart?: boolean;
  // Stable i18n code + interpolation params travel alongside the English
  // fallback in `message`, so the frontend can localise setup-result strings.
  code?: string;
  params?: Record<string, string>;
}

export interface SetupConnectionsResult {
  success: boolean;
  results: SetupStepResult[];
}

// An *arr instance a media server should register itself with (as an import
// notification target). baseUrl is the host-side address Ensembler calls.
export interface ArrTarget {
  service: string;
  baseUrl: string;
  apiKey: string;
}

export interface UserConfig {
  selectedServices: { [key: string]: boolean };
  paths: { [key: string]: string[] };
  ports: { [key: string]: number };
  environment: { tz: string; puid: number; pgid: number };
}
