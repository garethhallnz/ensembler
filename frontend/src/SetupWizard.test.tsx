import { render, screen, fireEvent } from '@testing-library/react';
import SetupWizard from './SetupWizard';

describe('SetupWizard navigation and validation', () => {
  it('renders first step and navigates forward and back', () => {
    render(<SetupWizard />);
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Select services to configure/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Next/i));
    // Should show error if neither Sonarr nor Radarr is selected
    expect(screen.getByText(/You must select at least Sonarr or Radarr/i)).toBeInTheDocument();
    // Select Sonarr, error should disappear, and Next should work
    fireEvent.click(screen.getByLabelText(/Sonarr/i));
    fireEvent.click(screen.getByText(/Next/i));
    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Set file paths for each selected service/i)).toBeInTheDocument();
    // Try to go next without entering required path
    fireEvent.click(screen.getByText(/Next/i));
    expect(screen.getByText(/TV Shows Path is required/i)).toBeInTheDocument();
    // Enter a path and proceed
    fireEvent.change(screen.getByPlaceholderText(/TV Shows Path/i), { target: { value: '/data/tv' } });
    fireEvent.click(screen.getByText(/Next/i));
    expect(screen.getByText(/Step 3 of 5/i)).toBeInTheDocument();
  });
}); 