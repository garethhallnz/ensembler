import { waitForReady } from './readiness';

describe('waitForReady', () => {
  it('resolves on the first probe when the service is already ready', async () => {
    const probe = jest.fn().mockResolvedValue(undefined);
    await waitForReady(probe, () => new Error('unused'), 50, 10);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('retries a failing probe until it succeeds', async () => {
    const probe = jest.fn()
      .mockRejectedValueOnce(new Error('not up'))
      .mockRejectedValueOnce(new Error('still not up'))
      .mockResolvedValue(undefined);
    await waitForReady(probe, () => new Error('unused'), 1000, 10);
    expect(probe).toHaveBeenCalledTimes(3);
  });

  it('throws the onTimeout error carrying the last probe error once the deadline passes', async () => {
    const probe = jest.fn().mockRejectedValue(new Error('connection refused'));
    await expect(
      waitForReady(probe, lastError => new Error(`gave up: ${lastError}`), 30, 10)
    ).rejects.toThrow('gave up: connection refused');
  });
});
