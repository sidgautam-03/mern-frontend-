import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage.jsx';

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), navigate: vi.fn() }));

vi.mock('../../Context/AuthContext.jsx', () => ({ useAuth: mocks.useAuth }));

// keep the real Link/MemoryRouter/useLocation, replace useNavigate to assert redirects
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

// the redirect happens 1 second after a successful login
const REDIRECT_WAIT = { timeout: 2500 };

const renderLogin = (entry = '/login') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LoginPage />
    </MemoryRouter>
  );

// labels are not linked to the inputs, so fields are found by their name attribute
const field = (container, name) => container.querySelector(`[name="${name}"]`);

const fillAndSubmit = async (container, email = 'test@example.com', password = 'secret123') => {
  await userEvent.type(field(container, 'email'), email);
  await userEvent.type(field(container, 'password'), password);
  await userEvent.click(screen.getByRole('button', { name: /login|logging in/i }));
};

describe('LoginPage', () => {
  let login;

  beforeEach(() => {
    vi.clearAllMocks();
    login = vi.fn().mockResolvedValue({});
    mocks.useAuth.mockReturnValue({ login });
  });

  it('shows the login form and a link to the register page', () => {
    const { container } = renderLogin();

    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(field(container, 'email')).toHaveAttribute('type', 'email');
    expect(field(container, 'password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });

  it('updates the fields as the user types', async () => {
    const { container } = renderLogin();

    await userEvent.type(field(container, 'email'), 'a@b.com');
    await userEvent.type(field(container, 'password'), 'pw');

    expect(field(container, 'email')).toHaveValue('a@b.com');
    expect(field(container, 'password')).toHaveValue('pw');
  });

  it('asks for both fields if the form is submitted empty', () => {
    const { container } = renderLogin();

    // fireEvent.submit skips the browser's own "required" check, so the page's own check runs
    fireEvent.submit(container.querySelector('form'));

    expect(screen.getByText('Please provide both email and password')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  describe('successful login', () => {
    it('calls login with the email and password, shows a success message and clears the form', async () => {
      const { container } = renderLogin();

      await fillAndSubmit(container);

      expect(login).toHaveBeenCalledWith('test@example.com', 'secret123');
      expect(await screen.findByText('Login successful! Redirecting...')).toBeInTheDocument();
      expect(field(container, 'email')).toHaveValue('');
      expect(field(container, 'password')).toHaveValue('');
      await waitFor(() => expect(mocks.navigate).toHaveBeenCalled(), REDIRECT_WAIT); // let the timer finish
    });

    it('redirects to the home page after one second', async () => {
      const { container } = renderLogin();

      await fillAndSubmit(container);

      expect(mocks.navigate).not.toHaveBeenCalled(); // not immediately
      await waitFor(
        () => expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true }),
        REDIRECT_WAIT
      );
    });

    it('redirects back to the protected page the user came from', async () => {
      const { container } = renderLogin({ pathname: '/login', state: { from: { pathname: '/cart' } } });

      await fillAndSubmit(container);

      await waitFor(
        () => expect(mocks.navigate).toHaveBeenCalledWith('/cart', { replace: true }),
        REDIRECT_WAIT
      );
    });
  });

  describe('loading state', () => {
    it('shows "Logging in..." and disables the button while the request is pending', async () => {
      login.mockReturnValue(new Promise(() => {}));
      const { container } = renderLogin();

      await fillAndSubmit(container);

      expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled();
    });
  });

  describe('failed login', () => {
    it('shows the server message and re-enables the button', async () => {
      login.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
      const { container } = renderLogin();

      await fillAndSubmit(container);

      expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('shows "Login failed" when the error has no server response', async () => {
      login.mockRejectedValue(new Error('Network Error'));
      const { container } = renderLogin();

      await fillAndSubmit(container);

      expect(await screen.findByText('Login failed')).toBeInTheDocument();
    });

    it('clears the old error when the user submits again', async () => {
      login.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce({});
      const { container } = renderLogin();

      await fillAndSubmit(container);
      expect(await screen.findByText('Login failed')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Login' }));

      expect(screen.queryByText('Login failed')).not.toBeInTheDocument();
      await waitFor(() => expect(mocks.navigate).toHaveBeenCalled(), REDIRECT_WAIT);
    });
  });
});