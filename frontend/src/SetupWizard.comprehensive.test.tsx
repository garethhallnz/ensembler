interface ElectronAPI {
  selectDirectory: jest.Mock<Promise<string>, []>;
}

// Mock Electron APIs
(window as unknown as { electronAPI: ElectronAPI }).electronAPI = {
  selectDirectory: jest.fn().mockResolvedValue('/selected/path'),
};

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

interface ServiceConfigMock {
  key: string;
  name: string;
  description: string;
  category: string;
  defaultPort: number;
  pathRequirements: { label: string; required: boolean; description: string }[];
  required: boolean;
}

interface ServiceConfigResponseMock {
  success: boolean;
  services: ServiceConfigMock[];
  maxServices: number;
}

interface CurrentConfigResponseMock {
  selectedServices: { [key: string]: boolean };
  paths: { [service: string]: string[] };
  ports: { [key: string]: number };
  environment: { tz: string; puid: number; pgid: number };
}

interface PathValidateResponseMock {
  success: boolean;
  results: { path: string; valid: boolean; error?: string }[];
}

describe('SetupWizard Comprehensive Tests', () => {
  const mockOnComplete = jest.fn();
  
  const mockServiceConfig = [
    {
      key: 'sonarr',
      name: 'Sonarr',
      description: 'PVR for Usenet and BitTorrent users',
      category: 'media',
      defaultPort: 8989,
      pathRequirements: [
        { label: 'TV Shows Path', required: true, description: 'Directory where TV shows will be stored' }
      ],
      required: false
    },
    {
      key: 'radarr',
      name: 'Radarr',
      description: 'Movie collection manager',
      category: 'media',
      defaultPort: 7878,
      pathRequirements: [
        { label: 'Movies Path', required: true, description: 'Directory where movies will be stored' }
      ],
      required: false
    },
    {
      key: 'plex',
      name: 'Plex',
      description: 'Media server',
      category: 'media',
      defaultPort: 32400,
      pathRequirements: [
        { label: 'TV Shows Path', required: true, description: 'Directory for TV shows' },
        { label: 'Movies Path', required: true, description: 'Directory for movies' }
      ],
      required: false
    }
  ];

  beforeEach(() => {
    mockFetch.mockClear();
    mockOnComplete.mockClear();
    (window as unknown as { electronAPI: ElectronAPI }).electronAPI.selectDirectory.mockClear();

    // Default mock for service configuration
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        services: mockServiceConfig,
        maxServices: 6
      } as ServiceConfigResponseMock)
    } as Response);
  });

  describe('initialization and service loading', () => {
    it('loads service configuration on mount', async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/services/config');
      });

      expect(screen.getByText('Sonarr')).toBeInTheDocument();
      expect(screen.getByText('Radarr')).toBeInTheDocument();
      expect(screen.getByText('Plex')).toBeInTheDocument();
    });

    it('shows loading state while fetching configuration', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<SetupWizard onComplete={mockOnComplete} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('handles service configuration fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<SetupWizard onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('re-run mode', () => {
    it('loads existing configuration in re-run mode', async () => {
      const existingConfig = {
        selectedServices: { sonarr: true, radarr: true },
        paths: { sonarr: ['/tv'], radarr: ['/movies'] },
        ports: { sonarr: 8989, radarr: 7878 },
        environment: { tz: 'America/New_York', puid: 1001, pgid: 1001 }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, services: mockServiceConfig, maxServices: 6 })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => existingConfig as CurrentConfigResponseMock
        } as Response);

      render(<SetupWizard onComplete={mockOnComplete} isRerun={true} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/config/current');
      });

      // Services should be pre-selected
      expect(screen.getByLabelText('Sonarr')).toBeChecked();
      expect(screen.getByLabelText('Radarr')).toBeChecked();
    });

    it('handles missing existing configuration gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, services: mockServiceConfig, maxServices: 6 })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        } as Response);

      render(<SetupWizard onComplete={mockOnComplete} isRerun={true} />);

      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      // Should start with empty configuration
      expect(screen.getByLabelText('Sonarr')).not.toBeChecked();
    });
  });

  describe('service selection step', () => {
    beforeEach(async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });
    });

    it('allows selecting and deselecting services', () => {
      const sonarrCheckbox = screen.getByLabelText('Sonarr');
      const radarrCheckbox = screen.getByLabelText('Radarr');

      fireEvent.click(sonarrCheckbox);
      expect(sonarrCheckbox).toBeChecked();

      fireEvent.click(radarrCheckbox);
      expect(radarrCheckbox).toBeChecked();

      fireEvent.click(sonarrCheckbox);
      expect(sonarrCheckbox).not.toBeChecked();
    });

    it('validates at least one required service is selected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: 'You must select at least Sonarr or Radarr.' })
      } as Response);

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('You must select at least Sonarr or Radarr.')).toBeInTheDocument();
      });
    });

    it('validates service count limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: 'Too many services selected. Maximum is 6 services.' })
      } as Response);

      // Select services
      fireEvent.click(screen.getByLabelText('Sonarr'));
      fireEvent.click(screen.getByLabelText('Radarr'));
      fireEvent.click(screen.getByLabelText('Plex'));

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Too many services selected. Maximum is 6 services.')).toBeInTheDocument();
      });
    });

    it('proceeds to next step when validation passes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Service selection is valid.' })
      } as Response);

      fireEvent.click(screen.getByLabelText('Sonarr'));
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      });
    });
  });

  describe('path configuration step', () => {
    beforeEach(async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      // Mock service validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      // Select services and proceed
      fireEvent.click(screen.getByLabelText('Sonarr'));
      fireEvent.click(screen.getByLabelText('Plex'));
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      });
    });

    it('displays path inputs for selected services', () => {
      expect(screen.getByPlaceholderText('Directory where TV shows will be stored')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Directory for TV shows')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Directory for movies')).toBeInTheDocument();
    });

    it('allows manual path entry', () => {
      const pathInput = screen.getByPlaceholderText('Directory where TV shows will be stored');
      fireEvent.change(pathInput, { target: { value: '/manual/tv/path' } });
      
      expect(pathInput).toHaveValue('/manual/tv/path');
    });

    it('allows path selection via browse button', async () => {
      const browseButton = screen.getAllByText('Browse')[0];
      fireEvent.click(browseButton);

      await waitFor(() => {
        expect(window.electronAPI.selectDirectory).toHaveBeenCalled();
      });

      expect(screen.getByPlaceholderText('Directory where TV shows will be stored')).toHaveValue('/selected/path');
    });

    it('validates paths when proceeding', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: [{ path: '/tv', valid: true }] })
      } as Response);

      const pathInput = screen.getByPlaceholderText('Directory where TV shows will be stored');
      fireEvent.change(pathInput, { target: { value: '/tv' } });

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/paths/validate',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ paths: ['/tv'] })
          })
        );
      });
    });

    it('shows path validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          results: [{ path: '/invalid', valid: false, error: 'Permission denied' }]
        } as PathValidateResponseMock)
      } as Response);

      const pathInput = screen.getByPlaceholderText('Directory where TV shows will be stored');
      fireEvent.change(pathInput, { target: { value: '/invalid' } });

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Permission denied')).toBeInTheDocument();
      });
    });

    it('skips validation when no required paths provided', async () => {
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
      });
    });
  });

  describe('port configuration step', () => {
    beforeEach(async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      
      // Navigate to port configuration step
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      // Step 1: Service selection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      fireEvent.click(screen.getByLabelText('Sonarr'));
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      });

      // Step 2: Skip paths
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
      });
    });

    it('displays default ports for selected services', () => {
      expect(screen.getByDisplayValue('8989')).toBeInTheDocument();
    });

    it('allows port customization', () => {
      const portInput = screen.getByDisplayValue('8989');
      fireEvent.change(portInput, { target: { value: '9999' } });
      
      expect(portInput).toHaveValue('9999');
    });

    it('validates port ranges', () => {
      const portInput = screen.getByDisplayValue('8989');
      fireEvent.change(portInput, { target: { value: '100' } });
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(screen.getByText('Port must be between 1024 and 65535')).toBeInTheDocument();
    });

    it('validates port conflicts', async () => {
      // Add another service to test conflicts
      fireEvent.click(screen.getByText('Back'));
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Back'));
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      fireEvent.click(screen.getByLabelText('Radarr'));
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
      });

      const sonarrPortInput = screen.getByDisplayValue('8989');
      fireEvent.change(sonarrPortInput, { target: { value: '7878' } });

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(screen.getByText('Port 7878 is already in use by Radarr')).toBeInTheDocument();
    });
  });

  describe('environment configuration step', () => {
    beforeEach(async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      
      // Navigate to environment step
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      fireEvent.click(screen.getByLabelText('Sonarr'));
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
      });
    });

    it('displays default environment values', () => {
      expect(screen.getByDisplayValue('UTC')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });

    it('allows environment variable customization', () => {
      const tzInput = screen.getByDisplayValue('UTC');
      fireEvent.change(tzInput, { target: { value: 'America/New_York' } });
      
      expect(tzInput).toHaveValue('America/New_York');

      const puidInput = screen.getByDisplayValue('1000');
      fireEvent.change(puidInput, { target: { value: '1001' } });
      
      expect(puidInput).toHaveValue('1001');
    });

    it('validates environment variables', () => {
      const puidInput = screen.getByDisplayValue('1000');
      fireEvent.change(puidInput, { target: { value: '-1' } });
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(screen.getByText('PUID must be a positive number')).toBeInTheDocument();
    });
  });

  describe('summary step', () => {
    beforeEach(async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      
      // Navigate through all steps to summary
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      // Step 1: Service selection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      fireEvent.click(screen.getByLabelText('Sonarr'));
      fireEvent.click(screen.getByText('Next'));

      // Step 2: Paths
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Next'));

      // Step 3: Ports
      await waitFor(() => {
        expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Next'));

      // Step 4: Environment
      await waitFor(() => {
        expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
      });
    });

    it('displays configuration summary', () => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Sonarr')).toBeInTheDocument();
      expect(screen.getByText('8989')).toBeInTheDocument();
    });

    it('allows going back to edit configuration', () => {
      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    });

    it('saves configuration and completes setup', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, message: 'Configuration saved' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, message: 'Docker Compose files generated' })
        } as Response);

      const saveButton = screen.getByText('Save and Apply');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/config/save',
          expect.objectContaining({ method: 'POST' })
        );
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/config/generate-compose',
        expect.objectContaining({ method: 'POST' })
      );

      expect(mockOnComplete).toHaveBeenCalled();
    });

    it('handles save errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Save failed'));

      const saveButton = screen.getByText('Save and Apply');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save configuration')).toBeInTheDocument();
      });

      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('shows saving progress', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const saveButton = screen.getByText('Save and Apply');
      fireEvent.click(saveButton);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });

  describe('navigation', () => {
    it('allows navigation between steps using back button', async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      fireEvent.click(screen.getByLabelText('Sonarr'));
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Back'));

      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });

    it('disables back button on first step', async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      const backButton = screen.getByText('Back');
      expect(backButton).toBeDisabled();
    });

    it('changes next button to save button on final step', async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      
      // Navigate to final step
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      // Go through all steps quickly
      for (let step = 1; step < 5; step++) {
        if (step === 1) {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
          fireEvent.click(screen.getByLabelText('Sonarr'));
        }
        
        fireEvent.click(screen.getByText(step === 5 ? 'Save and Apply' : 'Next'));
        
        if (step < 4) {
          await waitFor(() => {
            expect(screen.getByText(`Step ${step + 1} of 5`)).toBeInTheDocument();
          });
        }
      }

      await waitFor(() => {
        expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
      });

      expect(screen.getByText('Save and Apply')).toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });
  });

  describe('error recovery', () => {
    it('retains form data when validation fails', async () => {
      render(<SetupWizard onComplete={mockOnComplete} />);
      
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Sonarr'));
      fireEvent.click(screen.getByLabelText('Radarr'));

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: 'Validation failed' })
      } as Response);

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Validation failed')).toBeInTheDocument();
      });

      // Form data should be retained
      expect(screen.getByLabelText('Sonarr')).toBeChecked();
      expect(screen.getByLabelText('Radarr')).toBeChecked();
    });
  });
}); 