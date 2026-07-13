import { getAvailableUpdates, recordServiceUpdate } from '../services/updates';

describe('update cache', () => {
  it('records and reads a service update status', () => {
    recordServiceUpdate('sonarr', true);
    expect(getAvailableUpdates().updates.sonarr).toEqual({ hasUpdate: true });
  });

  it('overwrites a prior status for the same service', () => {
    recordServiceUpdate('radarr', true);
    recordServiceUpdate('radarr', false);
    expect(getAvailableUpdates().updates.radarr).toEqual({ hasUpdate: false });
  });

  it('preserves a null (undeterminable) status', () => {
    recordServiceUpdate('prowlarr', null);
    expect(getAvailableUpdates().updates.prowlarr).toEqual({ hasUpdate: null });
  });

  it('exposes a lastChecked Date', () => {
    expect(getAvailableUpdates().lastChecked).toBeInstanceOf(Date);
  });
});
