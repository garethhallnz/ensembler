import RuntimeManager, { runtimeManager, RuntimeConfig } from './runtimeManager';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window and document for browser environment
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    hidden: false,
  },
  writable: true,
});

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('RuntimeManager', () => {
  let manager: RuntimeManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    manager = new RuntimeManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = manager.getConfig();
      expect(config).toEqual({
        autoStartServices: false,
        autoStopServices: false,
        shutdownTimeout: 5000,
        checkInterval: 30000,
      });
    });

    it('should initialize with default status', () => {
      const status = manager.getStatus();
      expect(status.appRunning).toBe(false);
      expect(status.backendConnected).toBe(false);
      expect(status.dockerAvailable).toBe(false);
      expect(status.servicesRunning).toEqual([]);
    });

    it('should initialize and start monitoring', async () => {
      // Mock successful backend response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      const spy = jest.spyOn(manager, 'checkStatus');
      await manager.initialize();

      expect(spy).toHaveBeenCalled();
      expect(manager.getStatus().appRunning).toBe(true);
    });
  });

  describe('status checking', () => {
    it('should check backend connection successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            serviceStatus: { sonarr: 'Running', radarr: 'Stopped' }
          })
        } as Response);

      const status = await manager.checkStatus();

      expect(status.backendConnected).toBe(true);
      expect(status.dockerAvailable).toBe(true);
      expect(status.servicesRunning).toEqual(['sonarr']);
    });

    it('should handle backend connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const status = await manager.checkStatus();

      expect(status.backendConnected).toBe(false);
      expect(status.dockerAvailable).toBe(false);
      expect(status.servicesRunning).toEqual([]);
    });

    it('should handle Docker unavailable', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: false, compose: false })
        } as Response);

      const status = await manager.checkStatus();

      expect(status.backendConnected).toBe(true);
      expect(status.dockerAvailable).toBe(false);
      expect(status.servicesRunning).toEqual([]);
    });

    it('should handle service status check failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, message: 'Service check failed' })
        } as Response);

      const status = await manager.checkStatus();

      expect(status.backendConnected).toBe(true);
      expect(status.dockerAvailable).toBe(true);
      expect(status.servicesRunning).toEqual([]);
    });

    it('should update lastCheck timestamp', async () => {
      const beforeCheck = Date.now();
      
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));
      
      const status = await manager.checkStatus();
      
      const afterCheck = Date.now();
      expect(status.lastCheck.getTime()).toBeGreaterThanOrEqual(beforeCheck);
      expect(status.lastCheck.getTime()).toBeLessThanOrEqual(afterCheck);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig: Partial<RuntimeConfig> = {
        autoStartServices: true,
        checkInterval: 60000,
      };

      manager.updateConfig(newConfig);

      const config = manager.getConfig();
      expect(config.autoStartServices).toBe(true);
      expect(config.checkInterval).toBe(60000);
      expect(config.autoStopServices).toBe(false); // Should preserve existing
    });

    it('should not mutate original config object', () => {
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('runtime behavior', () => {
    it('should indicate app is running after initialization', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await manager.initialize();

      expect(manager.shouldContinueRunning()).toBe(true);
    });

    it('should indicate app is not running after shutdown', async () => {
      await manager.initialize();
      await manager.shutdown();

      expect(manager.shouldContinueRunning()).toBe(false);
    });

    it('should detect service independence', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            serviceStatus: { sonarr: 'Running' }
          })
        } as Response);

      await manager.checkStatus();

      expect(manager.areServicesIndependent()).toBe(true);
    });

    it('should detect no service independence when nothing running', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      await manager.checkStatus();

      expect(manager.areServicesIndependent()).toBe(false);
    });
  });

  describe('runtime information', () => {
    it('should provide runtime information', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docker: true, compose: true })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            serviceStatus: { sonarr: 'Running', radarr: 'Running' }
          })
        } as Response);

      await manager.checkStatus();
      const info = manager.getRuntimeInfo();

      expect(info.uptime).toBeGreaterThan(0);
      expect(info.backendConnected).toBe(true);
      expect(info.dockerIndependent).toBe(true);
      expect(info.serviceCount).toBe(2);
      expect(typeof info.memoryUsage).toBe('number');
    });
  });

  describe('monitoring', () => {
    it('should start monitoring after initialization', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await manager.initialize();

      // Fast forward time to trigger monitoring
      jest.advanceTimersByTime(30000);

      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial check + monitoring check
    });

    it('should stop monitoring during shutdown', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await manager.initialize();
      await manager.shutdown();

      // Fast forward time - should not trigger additional checks
      jest.advanceTimersByTime(30000);

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial check
    });

    it('should continue monitoring only while app is running', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await manager.initialize();
      
      // Simulate app shutdown
      const status = manager.getStatus();
      status.appRunning = false;

      // Fast forward time
      jest.advanceTimersByTime(30000);

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial check
    });
  });

  describe('cleanup handlers', () => {
    it('should setup window event listeners', async () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const documentAddEventListenerSpy = jest.spyOn(document, 'addEventListener');

      await manager.initialize();

      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unload', expect.any(Function));
      expect(documentAddEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('should handle visibility change events', async () => {
      const checkStatusSpy = jest.spyOn(manager, 'checkStatus');
      
      await manager.initialize();

      // Simulate app becoming visible
      Object.defineProperty(document, 'hidden', { value: false });
      
      // Find and call the visibility change handler
      const visibilityHandler = (document.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'visibilitychange')[1];
      
      visibilityHandler();

      expect(checkStatusSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle fetch timeout', async () => {
      const timeoutError = new Error('Request timeout');
      mockFetch.mockRejectedValueOnce(timeoutError);

      const status = await manager.checkStatus();

      expect(status.backendConnected).toBe(false);
      expect(status.dockerAvailable).toBe(false);
      expect(status.servicesRunning).toEqual([]);
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      } as Response);

      const status = await manager.checkStatus();

      expect(status.backendConnected).toBe(false);
    });

    it('should handle partial API failures gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response)
        .mockRejectedValueOnce(new Error('Docker API failed'));

      const status = await manager.checkStatus();

      expect(status.backendConnected).toBe(true);
      expect(status.dockerAvailable).toBe(false);
      expect(status.servicesRunning).toEqual([]);
    });
  });

  describe('singleton behavior', () => {
    it('should export a singleton instance', () => {
      expect(runtimeManager).toBeInstanceOf(RuntimeManager);
    });

    it('should return same instance across imports', () => {
      const manager1 = runtimeManager;
      const manager2 = runtimeManager;
      
      expect(manager1).toBe(manager2);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent checkStatus calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      // Start multiple concurrent status checks
      const promises = [
        manager.checkStatus(),
        manager.checkStatus(),
        manager.checkStatus()
      ];

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(result => {
        expect(result.backendConnected).toBe(true);
      });
    });

    it('should handle initialization during monitoring', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await manager.initialize();

      // Try to initialize again while monitoring is running
      await manager.initialize();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('resource management', () => {
    it('should clean up intervals on shutdown', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await manager.initialize();
      await manager.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should handle shutdown timeout', async () => {
      await manager.initialize();
      
      const shutdownPromise = manager.shutdown();
      
      // Fast forward past shutdown timeout
      jest.advanceTimersByTime(2000);
      
      await shutdownPromise;
      
      expect(manager.shouldContinueRunning()).toBe(false);
    });
  });
}); 