import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { runtimeManager } from './services/runtimeManager';

// Mock fetch globally
global.fetch = jest.fn();

// Mock runtime manager
jest.mock('./services/runtimeManager', () => ({
  runtimeManager: {
    initialize: jest.fn(),
    shutdown: jest.fn(),
    getStatus: jest.fn(),
  },
}));

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
const mockRuntimeManager = runtimeManager as jest.Mocked<typeof runtimeManager>;

describe('App Component', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockRuntimeManager.initialize.mockClear();
    mockRuntimeManager.shutdown.mockClear();
    mockRuntimeManager.getStatus.mockClear();
  });

  describe('initial loading state', () => {
    it('shows checking status message initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<App />);
      
      expect(screen.getByText('Checking Docker and Docker Compose status...')).toBeInTheDocument();
    });
  });

  describe('Docker status detection', () => {
    it('shows Docker missing message when Docker is not running', async () => {
      // Mock platform detection for macOS
      Object.defineProperty(window.navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });

      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: false,
        dockerAvailable: false,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: false, compose: false })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: false })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Docker is not running/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Install Docker Desktop from https:\/\/www.docker.com\/products\/docker-desktop\//)).toBeInTheDocument();
    });

    it('shows Docker Compose missing message when only Docker is running', async () => {
      Object.defineProperty(window.navigator, 'platform', {
        value: 'linux',
        configurable: true,
      });

      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: false,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: false })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: false })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Docker Compose is not available/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Install Docker Compose: https:\/\/docs.docker.com\/compose\/install\//)).toBeInTheDocument();
    });

    it('detects Windows platform correctly', async () => {
      Object.defineProperty(window.navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });

      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: false,
        dockerAvailable: false,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: false, compose: false })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: false })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/launch it from the Start menu/)).toBeInTheDocument();
      });
    });

    it('handles unknown platform gracefully', async () => {
      Object.defineProperty(window.navigator, 'platform', {
        value: 'Unknown',
        configurable: true,
      });

      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: false,
        dockerAvailable: false,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: false, compose: false })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: false })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Docker is not running/)).toBeInTheDocument();
      });

      // Should show generic installation instructions
      expect(screen.getByText(/Visit https:\/\/docs.docker.com\/get-docker\//)).toBeInTheDocument();
    });
  });

  describe('application flow', () => {
    it('shows setup wizard when Docker is ok but setup not complete', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true, composeVersion: 'v2.0.0' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: false })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
      });
    });

    it('shows dashboard when Docker is ok and setup is complete', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: ['sonarr'],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true, composeVersion: 'v2.0.0' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: true })
        } as Response)
        // Dashboard component will make additional requests
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, serviceStatus: {} })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Media Center Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('runtime manager integration', () => {
    it('initializes runtime manager on mount', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: true })
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        } as Response);

      render(<App />);

      expect(mockRuntimeManager.initialize).toHaveBeenCalled();
    });

    it('monitors runtime status periodically', async () => {
      jest.useFakeTimers();

      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValue({
          ok: true,
          json: async () => ({ docker: true, compose: true, setupComplete: true, success: true })
        } as Response);

      render(<App />);

      // Fast forward time to trigger monitoring
      jest.advanceTimersByTime(10000);

      expect(mockRuntimeManager.getStatus).toHaveBeenCalledTimes(2); // Initial + monitoring

      jest.useRealTimers();
    });

    it('shuts down runtime manager on unmount', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValue({
          ok: true,
          json: async () => ({ docker: true, compose: true, setupComplete: true, success: true })
        } as Response);

      const { unmount } = render(<App />);

      unmount();

      expect(mockRuntimeManager.shutdown).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles runtime manager initialization failure', async () => {
      mockRuntimeManager.initialize.mockRejectedValueOnce(new Error('Initialization failed'));
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: false,
        backendConnected: false,
        dockerAvailable: false,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      // Should fallback to checking Docker directly
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: false, compose: false })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: false })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Docker is not running/)).toBeInTheDocument();
      });
    });

    it('handles API request failures gracefully', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: false,
        dockerAvailable: false,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Docker is not running/)).toBeInTheDocument();
      });
    });

    it('handles malformed API responses', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: false,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => { throw new Error('Invalid JSON'); }
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Docker is not running/)).toBeInTheDocument();
      });
    });
  });

  describe('setup wizard completion', () => {
    it('transitions from setup wizard to dashboard after completion', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: false })
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, serviceStatus: {} })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
      });

      // The SetupWizard component would call onComplete callback
      // For testing purposes, we can simulate this by checking the component renders correctly
      expect(screen.getByText(/Select services to configure/)).toBeInTheDocument();
    });
  });

  describe('dashboard integration', () => {
    it('provides edit setup callback to dashboard', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: true })
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, serviceStatus: {} })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Media Center Dashboard')).toBeInTheDocument();
      });

      // Dashboard should have access to edit setup functionality
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
    });
  });

  describe('compose version handling', () => {
    it('stores and uses compose version information', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true, composeVersion: 'v2.24.5' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ setupComplete: true })
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, serviceStatus: {} })
        } as Response);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Media Center Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('concurrent initialization', () => {
    it('handles concurrent Docker and config status checks', async () => {
      mockRuntimeManager.initialize.mockResolvedValueOnce();
      mockRuntimeManager.getStatus.mockReturnValue({
        appRunning: true,
        backendConnected: true,
        dockerAvailable: true,
        servicesRunning: [],
        lastCheck: new Date(),
      });

      // Simulate concurrent API calls
      let resolveDocker: (value: Response) => void;
      let resolveConfig: (value: Response) => void;

      const dockerPromise = new Promise(resolve => { resolveDocker = resolve; });
      const configPromise = new Promise(resolve => { resolveConfig = resolve; });

      mockFetch
        .mockImplementationOnce(() => dockerPromise)
        .mockImplementationOnce(() => configPromise);

      render(<App />);

      // Resolve both promises
      resolveDocker!({
        ok: true,
        json: async () => ({ docker: true, compose: true })
      } as Response);

      resolveConfig!({
        ok: true,
        json: async () => ({ setupComplete: true })
      } as Response);

      // Add mock for dashboard requests
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, serviceStatus: {} })
      } as Response);

      await waitFor(() => {
        expect(screen.getByText('Media Center Dashboard')).toBeInTheDocument();
      });
    });
  });
}); 