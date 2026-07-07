export interface SetupStepResult {
  service: string;
  step: string;
  success: boolean;
  message: string;
}

export interface SetupConnectionsResult {
  success: boolean;
  results: SetupStepResult[];
}

export interface UserConfig {
  selectedServices: { [key: string]: boolean };
  paths: { [key: string]: string[] };
  ports: { [key: string]: number };
  environment: { tz: string; puid: number; pgid: number };
}
