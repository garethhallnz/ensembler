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

// Best-effort running version of a service's container. Tries the OCI image
// label first, then a per-service status API / exec, then falls back to the
// image build date. Returns 'Not installed' when the container isn't present.
export async function getServiceVersion(serviceName: string): Promise<string> {
  let version: string | null = null;

  // Try the image label for LinuxServer.io images first.
  switch (serviceName) {
    case 'sonarr':
    case 'radarr':
    case 'prowlarr':
    case 'overseerr':
    case 'plex':
    case 'transmission':
      version = await getImageLabel(serviceName, 'org.opencontainers.image.version');
      break;
    default:
      break;
  }

  if (!version) {
    switch (serviceName) {
      case 'sonarr': {
        const output = await execInContainer('sonarr', 'curl -s http://localhost:8989/api/v3/system/status');
        if (output) {
          try { version = JSON.parse(output).version || null; } catch { /* ignore */ }
        }
        break;
      }
      case 'radarr': {
        const output = await execInContainer('radarr', 'curl -s http://localhost:7878/api/v3/system/status');
        if (output) {
          try { version = JSON.parse(output).version || null; } catch { /* ignore */ }
        }
        break;
      }
      case 'prowlarr': {
        const output = await execInContainer('prowlarr', 'curl -s http://localhost:9696/api/v1/system/status');
        if (output) {
          try { version = JSON.parse(output).version || null; } catch { /* ignore */ }
        }
        break;
      }
      case 'overseerr': {
        const output = await execInContainer('overseerr', 'curl -s http://localhost:5055/api/v1/status');
        if (output) {
          try { version = JSON.parse(output).version || null; } catch { /* ignore */ }
        }
        break;
      }
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
