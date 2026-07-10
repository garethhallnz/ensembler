// Use requireActual so importing this module never triggers the jest.mock('fs'|'path'|'os')
// factories that reference it — that circularity throws a TDZ ReferenceError.
const fs = jest.requireActual('fs') as typeof import('fs');
const path = jest.requireActual('path') as typeof import('path');

// Mock file system state
export interface MockFile {
  content: string;
  stats: {
    isDirectory: boolean;
    isFile: boolean;
    size: number;
    mtime: Date;
    ctime: Date;
  };
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

export class MockFileSystem {
  private files: Map<string, MockFile> = new Map();
  private cwd: string = '/mock/workspace';

  // Normalize paths for consistent testing
  private normalizePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.cwd, filePath);
  }

  // Add a file to the mock filesystem
  addFile(filePath: string, content: string = '', options: Partial<MockFile> = {}): void {
    const normalizedPath = this.normalizePath(filePath);
    const defaultFile: MockFile = {
      content,
      stats: {
        isDirectory: false,
        isFile: true,
        size: content.length,
        mtime: new Date(),
        ctime: new Date()
      },
      permissions: {
        readable: true,
        writable: true,
        executable: false
      }
    };

    this.files.set(normalizedPath, { ...defaultFile, ...options });
  }

  // Add a directory to the mock filesystem
  addDirectory(dirPath: string, options: Partial<MockFile> = {}): void {
    const normalizedPath = this.normalizePath(dirPath);
    const defaultDir: MockFile = {
      content: '',
      stats: {
        isDirectory: true,
        isFile: false,
        size: 0,
        mtime: new Date(),
        ctime: new Date()
      },
      permissions: {
        readable: true,
        writable: true,
        executable: true
      }
    };

    this.files.set(normalizedPath, { ...defaultDir, ...options });
  }

  // Get a file from the mock filesystem
  getFile(filePath: string): MockFile | undefined {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.get(normalizedPath);
  }

  // Check if file exists
  exists(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.has(normalizedPath);
  }

  // Update file content
  updateFile(filePath: string, content: string): void {
    const normalizedPath = this.normalizePath(filePath);
    const file = this.files.get(normalizedPath);
    if (file) {
      file.content = content;
      file.stats.size = content.length;
      file.stats.mtime = new Date();
    }
  }

  // Remove file
  removeFile(filePath: string): void {
    const normalizedPath = this.normalizePath(filePath);
    this.files.delete(normalizedPath);
  }

  // Set file permissions
  setPermissions(filePath: string, permissions: Partial<MockFile['permissions']>): void {
    const normalizedPath = this.normalizePath(filePath);
    const file = this.files.get(normalizedPath);
    if (file) {
      file.permissions = { ...file.permissions, ...permissions };
    }
  }

  // Clear all files
  clear(): void {
    this.files.clear();
  }

  // Get all files (for debugging)
  getAllFiles(): Map<string, MockFile> {
    return new Map(this.files);
  }

  // Set current working directory
  setCwd(newCwd: string): void {
    this.cwd = newCwd;
  }
}

// Global mock filesystem instance
export const mockFileSystem = new MockFileSystem();

// Mock fs functions
export const mockFs = {
  existsSync: jest.fn().mockImplementation((filePath: string) => {
    return mockFileSystem.exists(filePath);
  }),

  readFileSync: jest.fn().mockImplementation((filePath: string, encoding?: string) => {
    const file = mockFileSystem.getFile(filePath);
    if (!file) {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`) as any;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'open';
      error.path = filePath;
      throw error;
    }
    if (!file.permissions.readable) {
      const error = new Error(`EACCES: permission denied, open '${filePath}'`) as any;
      error.code = 'EACCES';
      error.errno = -13;
      error.syscall = 'open';
      error.path = filePath;
      throw error;
    }
    return encoding === 'utf-8' || encoding === 'utf8' ? file.content : Buffer.from(file.content);
  }),

  writeFileSync: jest.fn().mockImplementation((filePath: string, data: string | Buffer) => {
    const content = typeof data === 'string' ? data : data.toString();
    const file = mockFileSystem.getFile(filePath);
    
    if (file && !file.permissions.writable) {
      const error = new Error(`EACCES: permission denied, open '${filePath}'`) as any;
      error.code = 'EACCES';
      error.errno = -13;
      error.syscall = 'open';
      error.path = filePath;
      throw error;
    }

    if (file) {
      mockFileSystem.updateFile(filePath, content);
    } else {
      // Create parent directories if they don't exist
      const dirPath = path.dirname(filePath);
      if (!mockFileSystem.exists(dirPath)) {
        mockFileSystem.addDirectory(dirPath);
      }
      mockFileSystem.addFile(filePath, content);
    }
  }),

  unlinkSync: jest.fn().mockImplementation((filePath: string) => {
    const file = mockFileSystem.getFile(filePath);
    if (!file) {
      const error = new Error(`ENOENT: no such file or directory, unlink '${filePath}'`) as any;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'unlink';
      error.path = filePath;
      throw error;
    }
    if (!file.permissions.writable) {
      const error = new Error(`EACCES: permission denied, unlink '${filePath}'`) as any;
      error.code = 'EACCES';
      error.errno = -13;
      error.syscall = 'unlink';
      error.path = filePath;
      throw error;
    }
    mockFileSystem.removeFile(filePath);
  }),

  mkdirSync: jest.fn().mockImplementation((dirPath: string, options?: any) => {
    const recursive = options?.recursive || false;
    
    if (mockFileSystem.exists(dirPath)) {
      if (!recursive) {
        const error = new Error(`EEXIST: file already exists, mkdir '${dirPath}'`) as any;
        error.code = 'EEXIST';
        error.errno = -17;
        error.syscall = 'mkdir';
        error.path = dirPath;
        throw error;
      }
      return;
    }

    if (recursive) {
      // Create parent directories
      const parent = path.dirname(dirPath);
      if (!mockFileSystem.exists(parent) && parent !== dirPath) {
        mockFs.mkdirSync(parent, { recursive: true });
      }
    } else {
      // Check if parent exists
      const parent = path.dirname(dirPath);
      if (!mockFileSystem.exists(parent)) {
        const error = new Error(`ENOENT: no such file or directory, mkdir '${dirPath}'`) as any;
        error.code = 'ENOENT';
        error.errno = -2;
        error.syscall = 'mkdir';
        error.path = dirPath;
        throw error;
      }
    }

    mockFileSystem.addDirectory(dirPath);
  }),

  accessSync: jest.fn().mockImplementation((filePath: string, mode?: number) => {
    const file = mockFileSystem.getFile(filePath);
    if (!file) {
      const error = new Error(`ENOENT: no such file or directory, access '${filePath}'`) as any;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'access';
      error.path = filePath;
      throw error;
    }

    const constants = fs.constants;
    mode = mode || constants.F_OK;

    if (mode & constants.R_OK && !file.permissions.readable) {
      const error = new Error(`EACCES: permission denied, access '${filePath}'`) as any;
      error.code = 'EACCES';
      error.errno = -13;
      error.syscall = 'access';
      error.path = filePath;
      throw error;
    }

    if (mode & constants.W_OK && !file.permissions.writable) {
      const error = new Error(`EACCES: permission denied, access '${filePath}'`) as any;
      error.code = 'EACCES';
      error.errno = -13;
      error.syscall = 'access';
      error.path = filePath;
      throw error;
    }

    if (mode & constants.X_OK && !file.permissions.executable) {
      const error = new Error(`EACCES: permission denied, access '${filePath}'`) as any;
      error.code = 'EACCES';
      error.errno = -13;
      error.syscall = 'access';
      error.path = filePath;
      throw error;
    }

    // Access granted
    return undefined;
  }),

  statSync: jest.fn().mockImplementation((filePath: string) => {
    const file = mockFileSystem.getFile(filePath);
    if (!file) {
      const error = new Error(`ENOENT: no such file or directory, stat '${filePath}'`) as any;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'stat';
      error.path = filePath;
      throw error;
    }

    return {
      ...file.stats,
      isDirectory: () => file.stats.isDirectory,
      isFile: () => file.stats.isFile,
      isSymbolicLink: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
    };
  }),

  constants: fs.constants
};

// Mock path functions
export const mockPath = {
  join: jest.fn().mockImplementation((...args: string[]) => path.join(...args)),
  resolve: jest.fn().mockImplementation((...args: string[]) => path.resolve(...args)),
  dirname: jest.fn().mockImplementation((filePath: string) => path.dirname(filePath)),
  basename: jest.fn().mockImplementation((filePath: string) => path.basename(filePath)),
  extname: jest.fn().mockImplementation((filePath: string) => path.extname(filePath)),
  isAbsolute: jest.fn().mockImplementation((filePath: string) => path.isAbsolute(filePath)),
  sep: path.sep,
  delimiter: path.delimiter
};

// Mock os functions
export const mockOs = {
  homedir: jest.fn().mockReturnValue('/mock/home'),
  platform: jest.fn().mockReturnValue('linux'),
  tmpdir: jest.fn().mockReturnValue('/mock/tmp'),
  hostname: jest.fn().mockReturnValue('mock-hostname'),
  type: jest.fn().mockReturnValue('Linux'),
  release: jest.fn().mockReturnValue('5.4.0'),
  arch: jest.fn().mockReturnValue('x64'),
  cpus: jest.fn().mockReturnValue([{ model: 'Mock CPU', speed: 2400 }]),
  totalmem: jest.fn().mockReturnValue(8000000000),
  freemem: jest.fn().mockReturnValue(4000000000)
};

// Setup default mock state for tests
export const setupDefaultFileSystem = () => {
  mockFileSystem.clear();
  
  // Create common directories
  mockFileSystem.addDirectory('/mock/home/.ensembler');
  mockFileSystem.addDirectory('/mock/workspace');
  mockFileSystem.addDirectory('/mock/tmp');
  
  // Create some default files
  const defaultConfig = {
    selectedServices: {
      sonarr: true,
      radarr: true
    },
    paths: {
      sonarr: ['/mock/media/tv'],
      radarr: ['/mock/media/movies']
    },
    ports: {
      sonarr: 8989,
      radarr: 7878
    },
    environment: {
      tz: 'UTC',
      puid: 1000,
      pgid: 1000
    }
  };
  
  mockFileSystem.addFile('/mock/home/.ensembler/config.json', JSON.stringify(defaultConfig, null, 2));
  mockFileSystem.addFile('/mock/home/.ensembler/.env', 'TZ=UTC\nPUID=1000\nPGID=1000\n');
  
  // Create media directories
  mockFileSystem.addDirectory('/mock/media/tv');
  mockFileSystem.addDirectory('/mock/media/movies');
  mockFileSystem.addDirectory('/mock/media/downloads');
};

// Export mock modules for jest.mock()
export const fileSystemMocks = {
  fs: mockFs,
  path: mockPath,
  os: mockOs
}; 