// Mock Docker container interface
export interface MockContainer {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'starting' | 'unhealthy';
  image: string;
  ports: string[];
  logs: string[];
}

// Mock Docker state
export class MockDockerState {
  containers: Map<string, MockContainer> = new Map();
  images: Map<string, any> = new Map();
  dockerRunning: boolean = true;
  composeAvailable: boolean = true;
  composeVersion: string = 'Docker Compose version v2.24.5';

  addContainer(container: MockContainer): void {
    this.containers.set(container.name, container);
  }

  getContainer(name: string): MockContainer | undefined {
    return this.containers.get(name);
  }

  updateContainerStatus(name: string, status: MockContainer['status']): void {
    const container = this.containers.get(name);
    if (container) {
      container.status = status;
    }
  }

  addImage(name: string, data: any): void {
    this.images.set(name, data);
  }

  setDockerRunning(running: boolean): void {
    this.dockerRunning = running;
  }

  setComposeAvailable(available: boolean): void {
    this.composeAvailable = available;
  }

  reset(): void {
    this.containers.clear();
    this.images.clear();
    this.dockerRunning = true;
    this.composeAvailable = true;
    this.composeVersion = 'Docker Compose version v2.24.5';
  }
}

// Global mock state
export const mockDockerState = new MockDockerState();

// Mock Docker API
export const mockDocker = {
  container: {
    list: jest.fn().mockImplementation(() => {
      if (!mockDockerState.dockerRunning) {
        throw new Error('Docker not running');
      }
      return Promise.resolve(Array.from(mockDockerState.containers.values()));
    }),
    
    get: jest.fn().mockImplementation((name: string) => {
      const container = mockDockerState.getContainer(name);
      if (!container) {
        throw new Error(`Container ${name} not found`);
      }
      return Promise.resolve(container);
    }),

    create: jest.fn().mockImplementation((options: any) => {
      const container: MockContainer = {
        id: `mock-${Math.random().toString(36).substr(2, 9)}`,
        name: options.name || 'mock-container',
        status: 'stopped',
        image: options.Image || 'mock-image',
        ports: options.ExposedPorts ? Object.keys(options.ExposedPorts) : [],
        logs: []
      };
      mockDockerState.addContainer(container);
      return Promise.resolve(container);
    }),

    start: jest.fn().mockImplementation((name: string) => {
      mockDockerState.updateContainerStatus(name, 'running');
      return Promise.resolve();
    }),

    stop: jest.fn().mockImplementation((name: string) => {
      mockDockerState.updateContainerStatus(name, 'stopped');
      return Promise.resolve();
    }),

    restart: jest.fn().mockImplementation((name: string) => {
      mockDockerState.updateContainerStatus(name, 'starting');
      setTimeout(() => {
        mockDockerState.updateContainerStatus(name, 'running');
      }, 100);
      return Promise.resolve();
    }),

    logs: jest.fn().mockImplementation((name: string) => {
      const container = mockDockerState.getContainer(name);
      const logs = container?.logs || ['Mock log entry 1', 'Mock log entry 2'];
      return Promise.resolve(logs.join('\n'));
    })
  },

  image: {
    list: jest.fn().mockImplementation(() => {
      return Promise.resolve(Array.from(mockDockerState.images.values()));
    }),

    get: jest.fn().mockImplementation((name: string) => {
      const image = mockDockerState.images.get(name);
      if (!image) {
        throw new Error(`Image ${name} not found`);
      }
      return Promise.resolve(image);
    }),

    pull: jest.fn().mockImplementation((name: string) => {
      const image = {
        id: `mock-image-${Math.random().toString(36).substr(2, 9)}`,
        name,
        created: new Date().toISOString(),
        size: 123456789
      };
      mockDockerState.addImage(name, image);
      return Promise.resolve(image);
    }),

    inspect: jest.fn().mockImplementation((name: string) => {
      const image = mockDockerState.images.get(name);
      if (!image) {
        throw new Error(`Image ${name} not found`);
      }
      return Promise.resolve({
        Created: image.created || '2023-01-01T00:00:00.000Z',
        RepoDigests: [`${name}@sha256:mock-digest`],
        Config: { ExposedPorts: {} }
      });
    })
  }
};

// Mock exec function for docker compose commands
export const mockExec = jest.fn().mockImplementation((command: string, callback?: any) => {
  const isCallback = typeof callback === 'function';
  
  // Simulate async execution
  const executeCommand = () => {
    let stdout = '';
    let stderr = '';
    let error = null;

    if (!mockDockerState.dockerRunning && command.includes('docker')) {
      error = new Error('Docker not running');
      stderr = 'Cannot connect to the Docker daemon';
    } else if (command.includes('docker compose version')) {
      if (mockDockerState.composeAvailable) {
        stdout = mockDockerState.composeVersion;
      } else {
        error = new Error('Docker Compose not found');
        stderr = 'docker: \'compose\' is not a docker command';
      }
    } else if (command.includes('docker compose')) {
      // Handle docker compose commands
      if (command.includes('start')) {
        const serviceName = command.split(' ').pop();
        if (serviceName && serviceName !== 'start') {
          mockDockerState.updateContainerStatus(serviceName, 'running');
        }
        stdout = 'Service started';
      } else if (command.includes('stop')) {
        const serviceName = command.split(' ').pop();
        if (serviceName && serviceName !== 'stop') {
          mockDockerState.updateContainerStatus(serviceName, 'stopped');
        }
        stdout = 'Service stopped';
      } else if (command.includes('restart')) {
        const serviceName = command.split(' ').pop();
        if (serviceName && serviceName !== 'restart') {
          mockDockerState.updateContainerStatus(serviceName, 'running');
        }
        stdout = 'Service restarted';
      } else if (command.includes('logs')) {
        stdout = 'Mock log output\nAnother log line';
      } else if (command.includes('up')) {
        stdout = 'Services started';
      } else if (command.includes('down')) {
        stdout = 'Services stopped';
      } else if (command.includes('pull')) {
        stdout = 'Images pulled';
      }
    } else if (command.includes('docker ps')) {
      // Handle docker ps commands
      const containers = Array.from(mockDockerState.containers.values());
      if (command.includes('--filter')) {
        const filterMatch = command.match(/--filter "name=([^"]+)"/);
        if (filterMatch) {
          const name = filterMatch[1];
          const container = mockDockerState.getContainer(name);
          if (container && container.status === 'running') {
            stdout = 'Up 5 minutes';
          } else {
            stdout = '';
          }
        }
      } else {
        stdout = containers.map(c => `${c.id} ${c.name} ${c.status}`).join('\n');
      }
    } else if (command.includes('docker image inspect')) {
      const imageMatch = command.match(/docker image inspect ([^\s]+)/);
      if (imageMatch) {
        const imageName = imageMatch[1];
        const image = mockDockerState.images.get(imageName) || mockDockerState.images.get(imageName.replace(':latest', ''));
        if (image) {
          stdout = image.created || '2023-01-01T00:00:00.000Z';
        } else {
          error = new Error('Image not found');
          stderr = 'No such image';
        }
      }
    } else if (command.includes('docker manifest inspect')) {
      stdout = JSON.stringify({
        manifests: [{
          digest: 'sha256:mock-latest-digest',
          platform: { architecture: 'amd64', os: 'linux' }
        }]
      });
    }

    return { error, stdout, stderr };
  };

  if (isCallback) {
    // Async callback style
    setTimeout(() => {
      const result = executeCommand();
      callback(result.error, result.stdout, result.stderr);
    }, 10);
    
    // Return a mock child process
    return {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn()
    };
  } else {
    // Promise style (for promisify)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const result = executeCommand();
        if (result.error) {
          reject(result.error);
        } else {
          resolve(result);
        }
      }, 10);
    });
  }
});

// Real child_process.exec defines promisify.custom so util.promisify(exec)
// resolves { stdout, stderr }; the mock needs the same or destructuring breaks.
(mockExec as any)[Symbol.for('nodejs.util.promisify.custom')] = (command: string) =>
  new Promise((resolve, reject) => {
    mockExec(command, (error: Error | null, stdout: string, stderr: string) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });

// Setup default mock state
export const setupDefaultMockState = () => {
  mockDockerState.reset();
  
  // Add some default containers
  mockDockerState.addContainer({
    id: 'mock-sonarr-1',
    name: 'sonarr',
    status: 'running',
    image: 'lscr.io/linuxserver/sonarr',
    ports: ['8989:8989'],
    logs: ['Sonarr starting...', 'Sonarr ready']
  });

  mockDockerState.addContainer({
    id: 'mock-radarr-1',
    name: 'radarr',
    status: 'stopped',
    image: 'lscr.io/linuxserver/radarr',
    ports: ['7878:7878'],
    logs: ['Radarr stopped']
  });

  // Add some default images
  mockDockerState.addImage('lscr.io/linuxserver/sonarr:latest', {
    id: 'mock-sonarr-image',
    name: 'lscr.io/linuxserver/sonarr:latest',
    created: '2023-12-01T00:00:00.000Z'
  });

  mockDockerState.addImage('lscr.io/linuxserver/radarr:latest', {
    id: 'mock-radarr-image',
    name: 'lscr.io/linuxserver/radarr:latest',
    created: '2023-12-01T00:00:00.000Z'
  });
};

// Export mock functions for jest.mock()
export const dockerMocks = {
  Docker: jest.fn().mockImplementation(() => mockDocker),
  exec: mockExec
}; 