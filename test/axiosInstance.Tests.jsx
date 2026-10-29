import { describe, it, expect, vi, beforeEach } from 'vitest';

// axios.create(...) returns an instance; we capture the interceptor registered on it
const mocks = vi.hoisted(() => {
  const use = vi.fn();
  const create = vi.fn(() => ({ interceptors: { request: { use } } }));
  return { create, use };
});

vi.mock('axios', () => ({ default: { create: mocks.create } }));

// the module runs axios.create() at import time, so import it fresh per test
const loadInstance = async () => {
  vi.resetModules();
  return (await import('../../api/axiosInstance.js')).default;
};

describe('axiosInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('creates the axios instance with baseURL taken from VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test/api');

    await loadInstance();

    expect(mocks.create).toHaveBeenCalledWith({ baseURL: 'http://api.test/api' });
  });

  it('exports the instance returned by axios.create', async () => {
    const instance = await loadInstance();

    expect(instance).toBe(mocks.create.mock.results[0].value);
  });

  it('registers exactly one request interceptor', async () => {
    await loadInstance();

    expect(mocks.use).toHaveBeenCalledTimes(1);
    expect(mocks.use).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('request interceptor', () => {
    const getInterceptor = async () => {
      await loadInstance();
      return mocks.use.mock.calls[0][0];
    };

    it('adds the Bearer token header when a token is stored', async () => {
      localStorage.setItem('token', 'abc123');
      const interceptor = await getInterceptor();

      const config = interceptor({ headers: {} });

      expect(config.headers.Authorization).toBe('Bearer abc123');
    });

    it('does not add an Authorization header when there is no token', async () => {
      const interceptor = await getInterceptor();

      const config = interceptor({ headers: {} });

      expect(config.headers.Authorization).toBeUndefined();
    });

    it('returns the same config object so the request continues', async () => {
      localStorage.setItem('token', 'abc123');
      const interceptor = await getInterceptor();
      const original = { headers: {}, url: '/products' };

      const result = interceptor(original);

      expect(result).toBe(original);
      expect(result.url).toBe('/products');
    });

    it('reads the token at request time, so a later login is picked up', async () => {
      const interceptor = await getInterceptor();

      expect(interceptor({ headers: {} }).headers.Authorization).toBeUndefined();

      localStorage.setItem('token', 'new-token');

      expect(interceptor({ headers: {} }).headers.Authorization).toBe('Bearer new-token');
    });
  });
});