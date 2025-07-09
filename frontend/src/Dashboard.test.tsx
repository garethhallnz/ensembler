import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Dashboard Component', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => 
      new Promise(() => {}) // Never resolves to test loading state
    );
    
    render(<Dashboard />);
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('renders dashboard with services after loading', async () => {
    // Mock service status response
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          serviceStatus: { sonarr: 'Running', radarr: 'Stopped' }
        })
      } as Response)
      // Mock docker status response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          docker: true,
          compose: true,
          composeVersion: 'v2.0.0'
        })
      } as Response)
      // Mock docker updates response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          docker: { updateAvailable: false },
          compose: { updateAvailable: false },
          lastChecked: new Date().toISOString()
        })
      } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Media Center Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Docker Status')).toBeInTheDocument();
    expect(screen.getByText('Global Controls')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
  });

  it('handles service actions (start/stop/restart)', async () => {
    // Setup initial mocks
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          serviceStatus: { sonarr: 'Running' }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docker: true, compose: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Media Center Dashboard')).toBeInTheDocument();
    });

    // Mock service action response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    // Mock updated service status after action
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        serviceStatus: { sonarr: 'Stopped' }
      })
    } as Response);

    // Find and click stop button
    const stopButton = screen.getByText('Stop');
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/services/sonarr/stop',
        { method: 'POST' }
      );
    });
  });

  it('displays service alerts when services fail', async () => {
    // Setup mocks with alerts
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          serviceStatus: { sonarr: 'Running' }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docker: true, compose: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response)
      // Service versions
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, version: 'latest' })
      } as Response)
      // Service updates
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hasUpdate: false,
          currentVersion: '1.0.0',
          updateAvailable: 'Up to date'
        })
      } as Response)
      // Service alerts/monitoring
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          services: {
            sonarr: {
              running: false,
              healthy: false,
              status: 'Container exited',
              alert: true
            }
          }
        })
      } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('⚠️ Alert: Container exited')).toBeInTheDocument();
    });
  });

  it('shows update buttons when updates are available', async () => {
    // Setup mocks with available updates
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          serviceStatus: { sonarr: 'Running' }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docker: true, compose: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response)
      // Service versions
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, version: 'v1.0.0' })
      } as Response)
      // Service updates - available
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hasUpdate: true,
          currentVersion: '1.0.0',
          updateAvailable: 'Update available'
        })
      } as Response)
      // Service alerts
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          services: {
            sonarr: { running: true, healthy: true, alert: false }
          }
        })
      } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('🔄 Update Available')).toBeInTheDocument();
      expect(screen.getByText('Update')).toBeInTheDocument();
    });
  });

  it('handles service updates with confirmation', async () => {
    // Mock window.confirm
    window.confirm = jest.fn(() => true);

    // Setup initial mocks
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          serviceStatus: { sonarr: 'Running' }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docker: true, compose: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, version: 'v1.0.0' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hasUpdate: true,
          currentVersion: '1.0.0',
          updateAvailable: 'Update available'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          services: { sonarr: { running: true, healthy: true, alert: false } }
        })
      } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    // Mock update response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    // Click update button
    const updateButton = screen.getByText('Update');
    fireEvent.click(updateButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to update sonarr? This will download the latest version and restart the service.'
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/services/sonarr/update',
        { method: 'POST' }
      );
    });
  });

  it('displays Docker update status', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, serviceStatus: {} })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docker: true, compose: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          docker: { updateAvailable: true, message: 'Docker update available' },
          compose: { updateAvailable: false, message: 'Docker Compose is up to date' },
          lastChecked: new Date().toISOString()
        })
      } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('🔄 Update Available')).toBeInTheDocument();
      expect(screen.getByText('✅ Up to Date')).toBeInTheDocument();
    });
  });

  it('handles global start/stop actions with confirmation', async () => {
    window.confirm = jest.fn(() => true);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          serviceStatus: { sonarr: 'Running', radarr: 'Running' }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docker: true, compose: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Stop All')).toBeInTheDocument();
    });

    // Mock stop all response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    // Mock service status after stop all
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        serviceStatus: { sonarr: 'Stopped', radarr: 'Stopped' }
      })
    } as Response);

    const stopAllButton = screen.getByText('Stop All');
    fireEvent.click(stopAllButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to stop all services?'
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/services/stop-all',
        { method: 'POST' }
      );
    });
  });

  it('toggles service logs', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          serviceStatus: { sonarr: 'Running' }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docker: true, compose: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Show Logs')).toBeInTheDocument();
    });

    // Mock logs response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        logs: 'Service started successfully\nProcessing files...'
      })
    } as Response);

    const showLogsButton = screen.getByText('Show Logs');
    fireEvent.click(showLogsButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/services/sonarr/logs'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Hide Logs')).toBeInTheDocument();
    });
  });
}); 