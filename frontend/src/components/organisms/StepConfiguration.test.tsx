import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect } from 'vitest';
import StepConfiguration from './StepConfiguration';

const service = {
  key: 'sonarr', name: 'Sonarr', description: 'TV', category: 'management', defaultPort: 8989,
  pathRequirements: [{ label: 'TV', required: true, description: 'tv folder' }], required: false,
};

describe('StepConfiguration', () => {
  it('renders the headings and review for a selected service', async () => {
    render(
      <StepConfiguration
        selected={{ sonarr: true }}
        serviceConfig={[service]}
        paths={{ sonarr: ['/tv'] }}
        pathErrors={{}}
        ports={{ sonarr: 8989 }}
        portErrors={{}}
        onPathChange={() => {}}
        onPortChange={() => {}}
        environment={{ tz: 'UTC', puid: 1000, pgid: 1000 }}
        envErrors={{}}
        onEnvironmentChange={() => {}}
      />,
    );
    await expect.element(page.getByText('Service configuration')).toBeInTheDocument();
    await expect.element(page.getByText('Environment settings')).toBeInTheDocument();
    await expect.element(page.getByText('Ready to set up')).toBeInTheDocument();
  });
});
