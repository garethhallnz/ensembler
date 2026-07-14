import { apiFetch } from '../requests/client';

export type RuntimeStatus = {
  appRunning: boolean;
  backendConnected: boolean;
  dockerAvailable: boolean;
  servicesRunning: string[];
  lastCheck: Date;
}

class RuntimeManager {
  private readonly checkIntervalMs = 30000;

  private status: RuntimeStatus = {
    appRunning: false,
    backendConnected: false,
    dockerAvailable: false,
    servicesRunning: [],
    lastCheck: new Date()
  };

  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Initialize the runtime manager
   */
  async initialize(): Promise<void> {
    console.log('Runtime Manager: Initializing...');
    this.status.appRunning = true;
    
    // Check initial status
    await this.checkStatus();
    
    // Start monitoring loop
    this.startMonitoring();
    
    // Re-check status when the window returns to the foreground
    this.setupVisibilityRefresh();

    console.log('Runtime Manager: Initialized successfully');
  }

  /**
   * Shutdown the runtime manager
   */
  async shutdown(): Promise<void> {
    console.log('Runtime Manager: Shutting down...');
    this.status.appRunning = false;
    
    // Stop monitoring
    this.stopMonitoring();
    
    // Wait for cleanup timeout
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Runtime Manager: Shutdown complete');
  }

  /**
   * Check the current runtime status
   */
  // Guards against overlapping checks: concurrent callers (monitor loop,
  // visibilitychange, dashboard refresh) share one in-flight run rather than
  // interleaving writes to this.status.
  private inFlight: Promise<RuntimeStatus> | null = null;

  async checkStatus(): Promise<RuntimeStatus> {
    if (this.inFlight) {
      return this.inFlight;
    }
    this.inFlight = this.runCheck();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async runCheck(): Promise<RuntimeStatus> {
    try {
      // Check backend connection
      const backendResponse = await apiFetch('/', {
        signal: AbortSignal.timeout(5000)
      });
      this.status.backendConnected = backendResponse.ok;

      if (this.status.backendConnected) {
        // Check Docker status
        const dockerResponse = await apiFetch('/api/docker/status', {
          signal: AbortSignal.timeout(5000)
        });
        const dockerData = await dockerResponse.json();
        this.status.dockerAvailable = dockerData.docker && dockerData.compose;

        if (this.status.dockerAvailable) {
          // Check service status
          const serviceResponse = await apiFetch('/api/services/status', {
            signal: AbortSignal.timeout(5000)
          });
          const serviceData = await serviceResponse.json();
          if (serviceData.success) {
            this.status.servicesRunning = Object.keys(serviceData.serviceStatus).filter(
              service => serviceData.serviceStatus[service] === 'Running'
            );
          }
        }
      }
    } catch (error) {
      console.warn('Runtime Manager: Status check failed:', error);
      this.status.backendConnected = false;
      this.status.dockerAvailable = false;
      this.status.servicesRunning = [];
    }

    this.status.lastCheck = new Date();
    return { ...this.status };
  }

  /**
   * Get current runtime status
   */
  getStatus(): RuntimeStatus {
    return { ...this.status };
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      if (this.status.appRunning) {
        await this.checkStatus();
      }
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring loop
   */
  private stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Re-check status when the app returns to the foreground.
   */
  private setupVisibilityRefresh(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.checkStatus();
    });
  }
}

// Singleton instance
export const runtimeManager = new RuntimeManager();