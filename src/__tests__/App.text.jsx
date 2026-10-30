import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthContext } from '../Context/AuthContext.jsx';

// These tests are about routing, so every page and the layout pieces are simple stand-ins.
// The real ProtectedRoute / AdminRoute are used, so the access rules are tested for real.
const stub = vi.hoisted(() => (tag, label) => async () => {
  const { createElement } = await import('react');
  return { default: () => createElement(tag, null, label) };
});

vi.mock('../components/Navbar.jsx', stub('nav', 'Navbar'));
vi.mock('../components/Footer.jsx', stub('footer', 'Footer'));
vi.mock('../pages/HomePage.jsx', stub('div', 'Home Page'));
vi.mock('../pages/ProductListPage.jsx', stub('div', 'Product List Page'));
vi.mock('../pages/ProductPage.jsx', stub('div', 'Product Page'));
vi.mock('../pages/CartPage.jsx', stub('div', 'Cart Page'));
vi.mock('../pages/CheckoutPage.jsx', stub('div', 'Checkout Page'));
vi.mock('../pages/OrderSuccessPage.jsx', stub('div', 'Order Success Page'));
vi.mock('../pages/LoginPage.jsx', stub('div', 'Login Page'));
vi.mock('../pages/RegisterPage.jsx', stub('div', 'Register Page'));
vi.mock('../pages/admin/AdminDashboard.jsx', stub('div', 'Admin Dashboard'));
vi.mock('../pages/admin/ProductFormPage.jsx', stub('div', 'Product Form Page'));

// the route guards read AuthContext directly, so mock it with a bare context
vi.mock('../Context/AuthContext.jsx', async () => {
  const { createContext } = await import('react');
  return { AuthContext: createContext(null) };
});

const customer = { name: 'Test User', role: 'customer' };
const admin = { name: 'Boss', role: 'admin' };

const renderApp = (path, auth = { user: null, loading: false }) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('App routing', () => {
  describe('layout', () => {
    it('always shows the navbar and the footer', () => {
      renderApp('/');

      expect(screen.getByText('Navbar')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });
  });

  describe('public routes', () => {
    it.each([
      ['/', 'Home Page'],
      ['/products', 'Product List Page'],
      ['/product/p1', 'Product Page'],
      ['/login', 'Login Page'],
      ['/register', 'Register Page'],
    ])('%s shows "%s" to a logged-out visitor', (path, label) => {
      renderApp(path);

      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('customer routes', () => {
    const customerRoutes = [
      ['/cart', 'Cart Page'],
      ['/checkout', 'Checkout Page'],
      ['/order-success/o1', 'Order Success Page'],
    ];

    it.each(customerRoutes)('%s sends a logged-out visitor to the login page', (path) => {
      renderApp(path);

      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    it.each(customerRoutes)('%s shows "%s" to a logged-in user', (path, label) => {
      renderApp(path, { user: customer, loading: false });

      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('shows "Authenticating..." instead of redirecting while the session loads', () => {
      renderApp('/cart', { user: null, loading: true });

      expect(screen.getByText('Authenticating...')).toBeInTheDocument();
      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });
  });

  describe('admin routes', () => {
    const adminRoutes = [
      ['/admin', 'Admin Dashboard'],
      ['/admin/products/new', 'Product Form Page'],
      ['/admin/products/p1/edit', 'Product Form Page'],
    ];

    it.each(adminRoutes)('%s shows "%s" to an admin', (path, label) => {
      renderApp(path, { user: admin, loading: false });

      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it.each(adminRoutes)('%s sends a normal customer to the home page', (path, label) => {
      renderApp(path, { user: customer, loading: false });

      expect(screen.getByText('Home Page')).toBeInTheDocument();
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });

    it.each(adminRoutes)('%s sends a logged-out visitor to the home page', (path) => {
      renderApp(path);

      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
  });

  describe('unknown routes', () => {
    it('shows the 404 page with the layout still around it', () => {
      renderApp('/this-page-does-not-exist');

      expect(screen.getByRole('heading', { name: '404 - Page Not Found' })).toBeInTheDocument();
      expect(screen.getByText('The route you requested does not exist.')).toBeInTheDocument();
      expect(screen.getByText('Navbar')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });
  });
});