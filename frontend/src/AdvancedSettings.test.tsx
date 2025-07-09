import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdvancedSettings from './AdvancedSettings';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('AdvancedSettings Component', () => {
  const mockOnClose = jest.fn();
  const mockConfig = {
    selectedServices: { sonarr: true, radarr: true },
    paths: { sonarr: ['/tv'], radarr: ['/movies'] },
    ports: { sonarr: 8989, radarr: 7878 },
    environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
  };

  beforeEach(() => {
    mockFetch.mockClear();
    mockOnClose.mockClear();
  });

  it('renders advanced settings form', async () => {
    // Mock config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig
    } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
    });

    expect(screen.getByText('Port Configuration')).toBeInTheDocument();
    expect(screen.getByText('Environment Variables')).toBeInTheDocument();
    expect(screen.getByText('Reset Configuration')).toBeInTheDocument();
  });

  it('loads and displays current configuration', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig
    } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('8989')).toBeInTheDocument();
      expect(screen.getByDisplayValue('7878')).toBeInTheDocument();
      expect(screen.getByDisplayValue('UTC')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });
  });

  it('handles port changes and validation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig
    } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('8989')).toBeInTheDocument();
    });

    // Change port value
    const sonarrPortInput = screen.getByDisplayValue('8989');
    fireEvent.change(sonarrPortInput, { target: { value: '9999' } });

    expect(screen.getByDisplayValue('9999')).toBeInTheDocument();

    // Test invalid port
    fireEvent.change(sonarrPortInput, { target: { value: '100' } });
    expect(screen.getByText('Port must be between 1024 and 65535')).toBeInTheDocument();

    // Test port conflict
    fireEvent.change(sonarrPortInput, { target: { value: '7878' } });
    expect(screen.getByText('Port 7878 is already in use by radarr')).toBeInTheDocument();
  });

  it('handles environment variable changes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig
    } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('UTC')).toBeInTheDocument();
    });

    // Change timezone
    const tzInput = screen.getByDisplayValue('UTC');
    fireEvent.change(tzInput, { target: { value: 'America/New_York' } });
    expect(screen.getByDisplayValue('America/New_York')).toBeInTheDocument();

    // Change PUID
    const puidInput = screen.getByDisplayValue('1000');
    fireEvent.change(puidInput, { target: { value: '1001' } });
    expect(screen.getByDisplayValue('1001')).toBeInTheDocument();

    // Test invalid PUID
    fireEvent.change(puidInput, { target: { value: '-1' } });
    expect(screen.getByText('PUID must be a positive number')).toBeInTheDocument();
  });

  it('saves configuration changes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Configuration saved' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Docker Compose files generated' })
      } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    // Make a change
    const puidInput = screen.getByDisplayValue('1000');
    fireEvent.change(puidInput, { target: { value: '1001' } });

    // Save changes
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/config/save',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('1001')
        })
      );
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/config/generate-compose',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('handles save errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig
      } as Response)
      .mockRejectedValueOnce(new Error('Save failed'));

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    // Try to save
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save configuration')).toBeInTheDocument();
    });
  });

  it('handles configuration reset with confirmation', async () => {
    window.confirm = jest.fn(() => true);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Configuration reset' })
      } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Reset Configuration')).toBeInTheDocument();
    });

    const resetButton = screen.getByText('Reset Configuration');
    fireEvent.click(resetButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to reset the configuration? This will delete all settings and stop all services.'
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/config/reset',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles reset cancellation', async () => {
    window.confirm = jest.fn(() => false);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig
    } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Reset Configuration')).toBeInTheDocument();
    });

    const resetButton = screen.getByText('Reset Configuration');
    fireEvent.click(resetButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial config load
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('handles reset errors', async () => {
    window.confirm = jest.fn(() => true);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig
      } as Response)
      .mockRejectedValueOnce(new Error('Reset failed'));

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Reset Configuration')).toBeInTheDocument();
    });

    const resetButton = screen.getByText('Reset Configuration');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to reset configuration')).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig
    } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<AdvancedSettings onClose={mockOnClose} />);

    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('handles missing configuration gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ success: false, message: 'config.json not found' })
    } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load configuration')).toBeInTheDocument();
    });
  });

  it('validates all form fields before saving', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig
    } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('8989')).toBeInTheDocument();
    });

    // Set invalid values
    const sonarrPortInput = screen.getByDisplayValue('8989');
    fireEvent.change(sonarrPortInput, { target: { value: '100' } });

    const puidInput = screen.getByDisplayValue('1000');
    fireEvent.change(puidInput, { target: { value: '-1' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    // Should show validation errors and not make save request
    expect(screen.getByText('Port must be between 1024 and 65535')).toBeInTheDocument();
    expect(screen.getByText('PUID must be a positive number')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial config load
  });

  it('handles service restart after configuration change', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Configuration saved' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Docker Compose files generated' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Services restarted' })
      } as Response);

    render(<AdvancedSettings onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    // Change port (should trigger restart)
    const sonarrPortInput = screen.getByDisplayValue('8989');
    fireEvent.change(sonarrPortInput, { target: { value: '9999' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/services/restart-all',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
}); 