import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../Context/AuthContext.jsx';
import API from '../../api/axiosInstance.js';

vi.mock('../../api/axiosInstance.js', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const profile = { _id: 'u1', name: 'Test User', email: 'test@example.com', role: 'customer' };
const loginResponse = { ...profile, token: 'jwt-token' };

const renderAuth = () => renderHook(() => useAuth(), { wrapper: AuthProvider });

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('restoring the session on page load', () => {
    it('finishes loading with no user and makes no request when there is no token', async () => {
      const { result } = renderAuth();

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(API.get).not.toHaveBeenCalled();
    });

    it('stays in the loading state while the profile request is pending', () => {
      localStorage.setItem('token', 'jwt-token');
      API.get.mockReturnValue(new Promise(() => {})); // never resolves

      const { result } = renderAuth();

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
    });

    it('loads the user from /auth/profile when a token is stored', async () => {
      localStorage.setItem('token', 'jwt-token');
      API.get.mockResolvedValue({ data: profile });

      const { result } = renderAuth();

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(API.get).toHaveBeenCalledWith('/auth/profile');
      expect(result.current.user).toEqual(profile);
    });

    it('removes an invalid/expired token and leaves the user logged out', async () => {
      localStorage.setItem('token', 'expired-token');
      API.get.mockRejectedValue(new Error('401'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderAuth();

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('posts the credentials, stores the token, sets the user and returns the data', async () => {
      API.post.mockResolvedValue({ data: loginResponse });
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returned;
      await act(async () => {
        returned = await result.current.login('test@example.com', 'secret123');
      });

      expect(API.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'secret123',
      });
      expect(localStorage.getItem('token')).toBe('jwt-token');
      expect(result.current.user).toEqual(loginResponse);
      expect(returned).toEqual(loginResponse);
    });

    it('rejects and stays logged out when the credentials are wrong', async () => {
      API.post.mockRejectedValue(new Error('Invalid email or password'));
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await expect(result.current.login('test@example.com', 'wrong')).rejects.toThrow(
          'Invalid email or password'
        );
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('register', () => {
    it('posts the details, stores the token and logs the new user in', async () => {
      API.post.mockResolvedValue({ data: loginResponse });
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returned;
      await act(async () => {
        returned = await result.current.register('Test User', 'test@example.com', 'secret123');
      });

      expect(API.post).toHaveBeenCalledWith('/auth/register', {
        name: 'Test User',
        email: 'test@example.com',
        password: 'secret123',
      });
      expect(localStorage.getItem('token')).toBe('jwt-token');
      expect(result.current.user).toEqual(loginResponse);
      expect(returned).toEqual(loginResponse);
    });

    it('rejects and stays logged out when registration fails', async () => {
      API.post.mockRejectedValue(new Error('User already exists'));
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await expect(
          result.current.register('Test User', 'test@example.com', 'secret123')
        ).rejects.toThrow('User already exists');
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears the token and the user', async () => {
      localStorage.setItem('token', 'jwt-token');
      API.get.mockResolvedValue({ data: profile });
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.user).toEqual(profile));

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('useAuth', () => {
    it('returns null when used outside an AuthProvider', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current).toBeNull();
    });
  });
});