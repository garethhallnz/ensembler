export interface RuntimeConfig {
  autoStartServices: boolean;
  autoStopServices: boolean;
  shutdownTimeout: number;
  checkInterval: number;
}

export type RuntimeStatus = {
  appRunning: boolean;
  backendConnected: boolean;
  dockerAvailable: boolean;
  servicesRunning: string[];
  lastCheck: Date;
}

declare global {
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}

class RuntimeManager {
  private config: RuntimeConfig = {
    autoStartServices: false, // Services should be managed manually
    autoStopServices: false,  // Services continue running when app closes
    shutdownTimeout: 5000,
    checkInterval: 30000
  };

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
    
    // Set up cleanup handlers
    this.setupCleanupHandlers();
    
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
  async checkStatus(): Promise<RuntimeStatus> {
    try {
      // Check backend connection
      const backendResponse = await fetch('http://localhost:3001/', {
        signal: AbortSignal.timeout(5000)
      });
      this.status.backendConnected = backendResponse.ok;

      if (this.status.backendConnected) {
        // Check Docker status
        const dockerResponse = await fetch('http://localhost:3001/api/docker/status');
        const dockerData = await dockerResponse.json();
        this.status.dockerAvailable = dockerData.docker && dockerData.compose;

        if (this.status.dockerAvailable) {
          // Check service status
          const serviceResponse = await fetch('http://localhost:3001/api/services/status');
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
   * Get runtime configuration
   */
  getConfig(): RuntimeConfig {
    return { ...this.config };
  }

  /**
   * Update runtime configuration
   */
  updateConfig(newConfig: Partial<RuntimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Runtime Manager: Config updated:', this.config);
  }

  /**
   * Check if the app should continue running
   */
  shouldContinueRunning(): boolean {
    return this.status.appRunning;
  }

  /**
   * Check if services are running independently
   */
  areServicesIndependent(): boolean {
    // Services are independent if they're running even when backend is not connected
    // or if Docker is available regardless of app status
    return this.status.dockerAvailable || this.status.servicesRunning.length > 0;
  }

  /**
   * Get app runtime information
   */
  getRuntimeInfo(): {
    uptime: number;
    memoryUsage: number;
    backendConnected: boolean;
    dockerIndependent: boolean;
    serviceCount: number;
  } {
    const now = Date.now();
    const startTime = this.status.lastCheck.getTime() - (this.config.checkInterval * 2);
    
    return {
      uptime: now - startTime,
      memoryUsage: performance.memory?.usedJSHeapSize || 0,
      backendConnected: this.status.backendConnected,
      dockerIndependent: this.areServicesIndependent(),
      serviceCount: this.status.servicesRunning.length
    };
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
    }, this.config.checkInterval);
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
   * Setup cleanup handlers for proper shutdown
   */
  private setupCleanupHandlers(): void {
    // Handle page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.shutdown();
      });

      window.addEventListener('unload', () => {
        this.shutdown();
      });

      // Handle visibility change (app becomes hidden)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          console.log('Runtime Manager: App hidden, continuing to run');
        } else {
          console.log('Runtime Manager: App visible, resuming normal operation');
          this.checkStatus();
        }
      });
    }

    // Handle process signals (Node.js environment)
    if (typeof process !== 'undefined') {
      process.on('SIGINT', async () => {
        console.log('Runtime Manager: Received SIGINT, shutting down gracefully...');
        await this.shutdown();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('Runtime Manager: Received SIGTERM, shutting down gracefully...');
        await this.shutdown();
        process.exit(0);
      });
    }
  }
}

// Singleton instance
export const runtimeManager = new RuntimeManager();

export default RuntimeManager; 