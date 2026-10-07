import { refitModel } from './refit-model';
import * as importModule from './import-model';

describe('refitModel', () => {
  const origFetch = globalThis.fetch;
  let importSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    importSpy = jest.spyOn(importModule, 'importModel').mockResolvedValue(undefined);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    jest.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('refuses with a plain message when model service returns 409 (empty log)', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
      }
      if (url.endsWith('/fit')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              detail: 'No practice data in schema "kgo" (demo-seeded history excluded; pass include_demo=true to include it)',
            }),
            { status: 409 },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected url ${url}`));
    }) as any;

    await refitModel({ includeDemo: false, url: 'http://127.0.0.1:8000' });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Refit refused: No practice data in schema "kgo"'),
    );
    expect(importSpy).not.toHaveBeenCalled();
  });

  it('refuses activation when fitted model does not beat default parameters on held-out log-loss', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
      }
      if (url.endsWith('/fit')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              modelVersion: 'bkt-em-test',
              source: 'demo',
              fittedAt: new Date().toISOString(),
              skills: {},
              evaluation: {
                heldOutLogLoss: 0.65,
                defaultLogLoss: 0.60,
                beatsDefault: false,
                testObservations: 100,
                testLearners: 5,
              },
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected url ${url}`));
    }) as any;

    await refitModel({ includeDemo: true, url: 'http://127.0.0.1:8000' });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Held-out log-loss: 0.6500 (default: 0.6000)'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Activation refused: fitted model log-loss (0.6500) did not beat default parameters (0.6000)'),
    );
    expect(process.exitCode).toBe(1);
    expect(importSpy).not.toHaveBeenCalled();
  });

  it('reports both numbers and activates when fitted model beats default parameters', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
      }
      if (url.endsWith('/fit')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              modelVersion: 'bkt-em-test',
              source: 'demo',
              fittedAt: new Date().toISOString(),
              skills: { 'math5.fractions.add': { prior: 0.2, learn: 0.1, guess: 0.2, slip: 0.05, fitted: true } },
              evaluation: {
                heldOutLogLoss: 0.45,
                defaultLogLoss: 0.60,
                beatsDefault: true,
                testObservations: 100,
                testLearners: 5,
              },
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected url ${url}`));
    }) as any;

    await refitModel({ includeDemo: true, url: 'http://127.0.0.1:8000' });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Held-out log-loss: 0.4500 (default: 0.6000)'),
    );
    expect(importSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ activate: true }),
    );
  });
});
