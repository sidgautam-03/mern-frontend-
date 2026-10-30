import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../../pages/RegisterPage.jsx';

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), navigate: vi.fn() }));

vi.mock('../../Context/AuthContext.jsx', () => ({ useAuth: mocks.useAuth }));

// RegisterPage imports the axios instance but does not use it; keep tests off the network
vi.mock('../../api/axiosInstance.js', () => ({ default: {} }));

// keep the real Link/MemoryRouter, replace useNavigate to assert redirects
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const renderRegister = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );

// the inputs have no name attribute: text and email are the two textboxes, password is found by type
const fields = (container) => {
  const [name, email] = screen.getAllByRole('textbox');
  return { name, email, password: container.querySelector('input[type="password"]') };
};

const fillForm = async (container, values = {}) => {
  const { name, email, password } = fields(container);
  const data = { name: 'Test User', email: 'test@example.com', password: 'secret123', ...values };
  await userEvent.type(name, data.name);
  await userEvent.type(email, data.email);
  await userEvent.type(password, data.password);
};

const clickRegister = () => userEvent.click(screen.getByRole('button', { name: /register|creating account/i }));

describe('RegisterPage', () => {
  let register;

  beforeEach(() => {
    vi.clearAllMocks();
    register = vi.fn().mockResolvedValue({});
    mocks.useAuth.mockReturnValue({ register });
  });

  it('shows the registration form and a link to the login page', () => {
    const { container } = renderRegister();

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(fields(container).email).toHaveAttribute('type', 'email');
    expect(fields(container).password).toHaveAttribute('minLength', '6');
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
  });

  it('updates the fields as the user types', async () => {
    const { container } = renderRegister();

    await fillForm(container);

    const { name, email, password } = fields(container);
    expect(name).toHaveValue('Test User');
    expect(email).toHaveValue('test@example.com');
    expect(password).toHaveValue('secret123');
  });

  describe('validation', () => {
    it('rejects a password shorter than 6 characters and does not call register', async () => {
      const { container } = renderRegister();
      await fillForm(container, { password: 'abc' });

      // fireEvent.submit skips the browser's own minLength check, so the page's own check runs
      fireEvent.submit(container.querySelector('form'));

      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('accepts a password of exactly 6 characters', async () => {
      const { container } = renderRegister();
      await fillForm(container, { password: '123456' });

      await clickRegister();

      expect(register).toHaveBeenCalledWith('Test User', 'test@example.com', '123456');
    });
  });

  describe('successful registration', () => {
    it('calls register with name, email and password, then goes to the home page', async () => {
      const { container } = renderRegister();
      await fillForm(container);

      await clickRegister();

      expect(register).toHaveBeenCalledWith('Test User', 'test@example.com', 'secret123');
      expect(mocks.navigate).toHaveBeenCalledWith('/');
    });
  });

  describe('loading state', () => {
    it('shows "Creating account..." and disables the button while pending', async () => {
      register.mockReturnValue(new Promise(() => {}));
      const { container } = renderRegister();
      await fillForm(container);

      await clickRegister();

      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled();
    });
  });

  describe('failed registration', () => {
    it('shows the server message, re-enables the button and does not redirect', async () => {
      register.mockRejectedValue({ response: { data: { message: 'User already exists' } } });
      const { container } = renderRegister();
      await fillForm(container);

      await clickRegister();

      expect(await screen.findByText('User already exists')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('shows "Registration failed" when the error has no server response', async () => {
      register.mockRejectedValue(new Error('Network Error'));
      const { container } = renderRegister();
      await fillForm(container);

      await clickRegister();

      expect(await screen.findByText('Registration failed')).toBeInTheDocument();
    });

    it('clears the old error when the user submits again', async () => {
      register.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce({});
      const { container } = renderRegister();
      await fillForm(container);

      await clickRegister();
      expect(await screen.findByText('Registration failed')).toBeInTheDocument();

      await clickRegister();

      expect(screen.queryByText('Registration failed')).not.toBeInTheDocument();
      expect(mocks.navigate).toHaveBeenCalledWith('/');
    });
  });
});