import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../../components/Navbar.jsx';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCart: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../Context/AuthContext.jsx', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../Context/CartContext.jsx', () => ({ useCart: mocks.useCart }));

// keep the real Link/MemoryRouter, but replace useNavigate so we can assert redirects
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const renderNavbar = () =>
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );

describe('Navbar', () => {
  let logout;

  const setup = ({ user = null, itemCount = 0 } = {}) => {
    mocks.useAuth.mockReturnValue({ user, logout });
    mocks.useCart.mockReturnValue({ itemCount });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    logout = vi.fn();
    setup();
  });

  describe('links that are always visible', () => {
    it('shows the brand, Home, Products and Cart links with the right destinations', () => {
      renderNavbar();

      expect(screen.getByRole('link', { name: /mini commerce/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /products/i })).toHaveAttribute('href', '/products');
      expect(screen.getByRole('link', { name: /cart/i })).toHaveAttribute('href', '/cart');
    });
  });

  describe('logged-out visitor', () => {
    it('shows a Login link and no Logout button', () => {
      renderNavbar();

      expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
      expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
    });

    it('does not show the Admin link', () => {
      renderNavbar();

      expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
    });
  });

  describe('logged-in customer', () => {
    beforeEach(() => {
      setup({ user: { name: 'Test User', role: 'customer' } });
    });

    it('shows the logout button with the user name and no Login link', () => {
      renderNavbar();

      expect(screen.getByRole('button', { name: /logout \(test user\)/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument();
    });

    it('does not show the Admin link', () => {
      renderNavbar();

      expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
    });

    it('logs out and redirects to /login when Logout is clicked', async () => {
      renderNavbar();

      await userEvent.click(screen.getByRole('button', { name: /logout/i }));

      expect(logout).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('admin user', () => {
    it('shows the Admin link pointing to /admin', () => {
      setup({ user: { name: 'Boss', role: 'admin' } });

      renderNavbar();

      expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin');
    });
  });

  describe('cart badge', () => {
    it('is hidden when the cart is empty', () => {
      setup({ itemCount: 0 });

      renderNavbar();

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('shows the item count when the cart has items', () => {
      setup({ itemCount: 3 });

      renderNavbar();

      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });
});