export interface ServiceConfig {
  key: string;
  name: string;
  image: string;
  defaultPort: number;
  internalPort: number;
  category: 'media' | 'torrent' | 'indexer' | 'request';
  description: string;
  required: boolean;
  pathRequirements: {
    label: string;
    required: boolean;
    description: string;
  }[];
  environmentVars?: { [key: string]: string };
  additionalPorts?: number[];
  healthCheck?: {
    enabled: boolean;
    path?: string;
    interval?: number;
  };
  updateStrategy: 'latest' | 'stable' | 'version';
  dependencies?: string[];
  volumes: {
    hostPath: string;
    containerPath: string;
    type: 'config' | 'data' | 'media';
  }[];
  launchUrl?: string;
}

export const SUPPORTED_SERVICES: ServiceConfig[] = [
  {
    key: 'prowlarr',
    name: 'Prowlarr',
    image: 'lscr.io/linuxserver/prowlarr:latest',
    defaultPort: 9696,
    internalPort: 9696,
    category: 'indexer',
    description: 'Indexer manager/proxy built on the popular arr stack',
    required: false,
    pathRequirements: [],
    healthCheck: {
      enabled: true,
      path: '/health',
      interval: 30000
    },
    updateStrategy: 'latest',
    volumes: [
      {
        hostPath: '{configDir}/prowlarr/config',
        containerPath: '/config',
        type: 'config'
      }
    ]
  },
  {
    key: 'sonarr',
    name: 'Sonarr',
    image: 'lscr.io/linuxserver/sonarr:latest',
    defaultPort: 8989,
    internalPort: 8989,
    category: 'media',
    description: 'PVR for Usenet and BitTorrent users',
    required: false,
    pathRequirements: [
      {
        label: 'TV Shows Path',
        required: true,
        description: 'Directory where TV shows will be stored'
      }
    ],
    healthCheck: {
      enabled: true,
      path: '/health',
      interval: 30000
    },
    updateStrategy: 'latest',
    volumes: [
      {
        hostPath: '{configDir}/sonarr/config',
        containerPath: '/config',
        type: 'config'
      },
      {
        hostPath: '{paths.tv}',
        containerPath: '/tv',
        type: 'media'
      }
    ]
  },
  {
    key: 'radarr',
    name: 'Radarr',
    image: 'lscr.io/linuxserver/radarr:latest',
    defaultPort: 7878,
    internalPort: 7878,
    category: 'media',
    description: 'Movie collection manager for Usenet and BitTorrent users',
    required: false,
    pathRequirements: [
      {
        label: 'Movies Path',
        required: true,
        description: 'Directory where movies will be stored'
      }
    ],
    healthCheck: {
      enabled: true,
      path: '/health',
      interval: 30000
    },
    updateStrategy: 'latest',
    volumes: [
      {
        hostPath: '{configDir}/radarr/config',
        containerPath: '/config',
        type: 'config'
      },
      {
        hostPath: '{paths.movies}',
        containerPath: '/movies',
        type: 'media'
      }
    ]
  },
  {
    key: 'plex',
    name: 'Plex',
    image: 'lscr.io/linuxserver/plex:latest',
    defaultPort: 32400,
    internalPort: 32400,
    category: 'media',
    description: 'Media server for streaming your content',
    required: false,
    pathRequirements: [
      {
        label: 'TV Shows Path',
        required: true,
        description: 'Directory containing your TV shows'
      },
      {
        label: 'Movies Path',
        required: true,
        description: 'Directory containing your movies'
      }
    ],
    healthCheck: {
      enabled: true,
      path: '/web/index.html',
      interval: 30000
    },
    updateStrategy: 'latest',
    volumes: [
      {
        hostPath: '{configDir}/plex/config',
        containerPath: '/config',
        type: 'config'
      },
      {
        hostPath: '{paths.tv}',
        containerPath: '/tv',
        type: 'media'
      },
      {
        hostPath: '{paths.movies}',
        containerPath: '/movies',
        type: 'media'
      }
    ],
    launchUrl: '/web'
  },
  {
    key: 'transmission',
    name: 'Transmission',
    image: 'lscr.io/linuxserver/transmission:latest',
    defaultPort: 9091,
    internalPort: 9091,
    category: 'torrent',
    description: 'BitTorrent client',
    required: false,
    pathRequirements: [
      {
        label: 'Downloads Path',
        required: true,
        description: 'Directory where downloads will be stored'
      }
    ],
    additionalPorts: [51413],
    healthCheck: {
      enabled: true,
      path: '/transmission/web/',
      interval: 30000
    },
    updateStrategy: 'latest',
    volumes: [
      {
        hostPath: '{configDir}/transmission/config',
        containerPath: '/config',
        type: 'config'
      },
      {
        hostPath: '{paths.downloads}',
        containerPath: '/downloads',
        type: 'data'
      }
    ]
  },
  {
    key: 'overseerr',
    name: 'Overseerr',
    image: 'lscr.io/linuxserver/overseerr:latest',
    defaultPort: 5055,
    internalPort: 5055,
    category: 'request',
    description: 'Request management and media discovery tool',
    required: false,
    pathRequirements: [],
    healthCheck: {
      enabled: true,
      path: '/api/v1/status',
      interval: 30000
    },
    updateStrategy: 'latest',
    volumes: [
      {
        hostPath: '{configDir}/overseerr/config',
        containerPath: '/config',
        type: 'config'
      }
    ]
  }
];

// Future services that can be easily added
export const FUTURE_SERVICES: ServiceConfig[] = [
  {
    key: 'deluge',
    name: 'Deluge',
    image: 'lscr.io/linuxserver/deluge:latest',
    defaultPort: 8112,
    internalPort: 8112,
    category: 'torrent',
    description: 'BitTorrent client with web interface',
    required: false,
    pathRequirements: [
      {
        label: 'Downloads Path',
        required: true,
        description: 'Directory where downloads will be stored'
      }
    ],
    additionalPorts: [58846],
    healthCheck: {
      enabled: true,
      path: '/',
      interval: 30000
    },
    updateStrategy: 'latest',
    volumes: [
      {
        hostPath: '{configDir}/deluge/config',
        containerPath: '/config',
        type: 'config'
      },
      {
        hostPath: '{paths.downloads}',
        containerPath: '/downloads',
        type: 'data'
      }
    ]
  },
  {
    key: 'kodi',
    name: 'Kodi',
    image: 'lscr.io/linuxserver/kodi-headless:latest',
    defaultPort: 8080,
    internalPort: 8080,
    category: 'media',
    description: 'Open source media player and entertainment hub',
    required: false,
    pathRequirements: [
      {
        label: 'TV Shows Path',
        required: true,
        description: 'Directory containing your TV shows'
      },
      {
        label: 'Movies Path',
        required: true,
        description: 'Directory containing your movies'
      }
    ],
    healthCheck: {
      enabled: true,
      path: '/jsonrpc',
      interval: 30000
    },
    updateStrategy: 'latest',
    volumes: [
      {
        hostPath: '{configDir}/kodi/config',
        containerPath: '/config',
        type: 'config'
      },
      {
        hostPath: '{paths.tv}',
        containerPath: '/tv',
        type: 'media'
      },
      {
        hostPath: '{paths.movies}',
        containerPath: '/movies',
        type: 'media'
      }
    ]
  }
];

export const MAX_SERVICES = 6;

export function getServiceConfig(serviceKey: string): ServiceConfig | undefined {
  return SUPPORTED_SERVICES.find(service => service.key === serviceKey);
}

export function getServicesByCategory(category: string): ServiceConfig[] {
  return SUPPORTED_SERVICES.filter(service => service.category === category);
}

export function validateServiceLimit(selectedServices: string[]): boolean {
  return selectedServices.length <= MAX_SERVICES;
}

export function getDefaultPorts(): { [key: string]: number } {
  const ports: { [key: string]: number } = {};
  SUPPORTED_SERVICES.forEach(service => {
    ports[service.key] = service.defaultPort;
  });
  return ports;
}

export function getServiceImages(): { [key: string]: string } {
  const images: { [key: string]: string } = {};
  SUPPORTED_SERVICES.forEach(service => {
    images[service.key] = service.image;
  });
  return images;
}

export function getPathRequirements(serviceKey: string): { label: string; required: boolean; description: string }[] {
  const service = getServiceConfig(serviceKey);
  return service?.pathRequirements || [];
}

export function canAddMoreServices(currentServices: string[]): boolean {
  return currentServices.length < MAX_SERVICES && 
         (SUPPORTED_SERVICES.length + FUTURE_SERVICES.length) > currentServices.length;
} 