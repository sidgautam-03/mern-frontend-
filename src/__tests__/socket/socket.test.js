import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// io() returns a fake socket, so no real connection is attempted
const mocks = vi.hoisted(() => {
  const fakeSocket = { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
  return { fakeSocket, io: vi.fn(() => fakeSocket) };
});

vi.mock('socket.io-client', () => ({ io: mocks.io }));

// the module calls io() at import time, so import it fresh for each test
const loadModule = async () => {
  vi.resetModules();
  return import('../../socket/socket.js');
};

describe('socket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('connects to the URL from VITE_SOCKET_URL', async () => {
    vi.stubEnv('VITE_SOCKET_URL', 'http://localhost:5000');

    await loadModule();

    expect(mocks.io).toHaveBeenCalledTimes(1);
    expect(mocks.io).toHaveBeenCalledWith('http://localhost:5000', expect.any(Object));
  });

  it('uses the websocket transport only', async () => {
    vi.stubEnv('VITE_SOCKET_URL', 'http://localhost:5000');

    await loadModule();

    expect(mocks.io).toHaveBeenCalledWith(
      'http://localhost:5000',
      expect.objectContaining({ transports: ['websocket'] })
    );
  });

  it('exports the socket returned by io()', async () => {
    vi.stubEnv('VITE_SOCKET_URL', 'http://localhost:5000');

    const { socket } = await loadModule();

    expect(socket).toBe(mocks.fakeSocket);
  });

  it('passes undefined to io() when VITE_SOCKET_URL is not set', async () => {
    vi.stubEnv('VITE_SOCKET_URL', undefined);

    await loadModule();

    expect(mocks.io.mock.calls[0][0]).toBeUndefined();
  });

  it('creates the connection once, even if the module is imported twice', async () => {
    vi.stubEnv('VITE_SOCKET_URL', 'http://localhost:5000');
    vi.resetModules();

    await import('../../socket/socket.js');
    await import('../../socket/socket.js');

    expect(mocks.io).toHaveBeenCalledTimes(1);
  });
});