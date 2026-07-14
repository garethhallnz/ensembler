import { execAsync } from './exec';

async function execInContainer(container: string, cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`docker exec ${container} sh -c "${cmd}"`);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function getImageLabel(container: string, label: string): Promise<string | null> {
  try {
    const { stdout: imageNameOut } = await execAsync(
      `docker inspect --format='{{.Config.Image}}' ${container}`
    );
    const imageName = imageNameOut.trim();
    if (!imageName) return null;
    const { stdout: labelOut } = await execAsync(
      `docker image inspect ${imageName} --format='{{ index .Config.Labels "${label}" }}'`
    );
    return labelOut.trim() || null;
  } catch {
    return null;
  }
}

// Services that publish an OCI image-version label (LinuxServer.io images).
const IMAGE_LABEL_SERVICES = new Set(['sonarr', 'radarr', 'prowlarr', 'overseerr', 'plex', 'transmission']);

// *arr-style status APIs whose JSON carries a `version` field. Port + path
// differ per service; everything else about the probe is identical.
const ARR_STATUS_APIS: Record<string, string> = {
  sonarr: 'http://localhost:8989/api/v3/system/status',
  radarr: 'http://localhost:7878/api/v3/system/status',
  prowlarr: 'http://localhost:9696/api/v1/system/status',
  overseerr: 'http://localhost:5055/api/v1/status',
};

// Best-effort running version of a service's container. Tries the OCI image
// label first, then a per-service status API / exec, then falls back to the
// image build date. Returns 'Not installed' when the container isn't present.
export async function getServiceVersion(serviceName: string): Promise<string> {
  let version: string | null = null;

  // Try the image label for LinuxServer.io images first.
  if (IMAGE_LABEL_SERVICES.has(serviceName)) {
    version = await getImageLabel(serviceName, 'org.opencontainers.image.version');
  }

  // Then the *arr-style status API (uniform shape, per-service endpoint).
  const statusApi = ARR_STATUS_APIS[serviceName];
  if (!version && statusApi) {
    const output = await execInContainer(serviceName, `curl -s ${statusApi}`);
    if (output) {
      try { version = JSON.parse(output).version || null; } catch { /* ignore */ }
    }
  }

  // Bespoke probes for services without a status API.
  if (!version) {
    switch (serviceName) {
      case 'plex': {
        version = await execInContainer('plex', 'cat /version.txt');
        if (!version) {
          version = await execInContainer('plex', 'dpkg-query -W plexmediaserver');
          if (version) {
            version = version.split('\t')[1] || version;
          }
        }
        break;
      }
      case 'transmission': {
        version = await execInContainer('transmission', 'transmission-daemon --version');
        if (version) {
          const match = version.match(/(\d+\.\d+(?:\.\d+)?)/);
          version = match ? match[1] : version;
        }
        break;
      }
      default:
        break;
    }
  }

  if (version) return version;

  // Fallback: the image creation date.
  try {
    const { stdout: containerImage } = await execAsync(
      `docker inspect --format='{{.Config.Image}}' ${serviceName}`
    );
    const imageName = containerImage.trim();
    if (!imageName) return 'Not installed';
    const { stdout } = await execAsync(
      `docker image inspect ${imageName} --format "{{.Created}}"`
    );
    return stdout.trim().split('T')[0] || 'Not installed';
  } catch {
    return 'Not installed';
  }
}
