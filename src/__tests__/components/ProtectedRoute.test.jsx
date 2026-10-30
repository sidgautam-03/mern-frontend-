import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from '../../components/ProtectedRoute.jsx';
import { AuthContext } from '../../Context/AuthContext.jsx';

// The routes read AuthContext directly, so mock the module with a bare context
// (this avoids loading the real provider and its API/socket imports)
vi.mock('../../Context/AuthContext.jsx', async () => {
  const { createContext } = await import('react');
  return { AuthContext: createContext(null) };
});

const renderRoutes = ({ path, auth }) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<div>Account Page</div>} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<div>Admin Page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

const customer = { name: 'Test User', role: 'customer' };
const admin = { name: 'Boss', role: 'admin' };

describe('ProtectedRoute', () => {
  it('shows "Authenticating..." while the session is loading', () => {
    renderRoutes({ path: '/account', auth: { user: null, loading: true } });

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(screen.queryByText('Account Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument(); // no redirect yet
  });

  it('renders the protected page for a logged-in user', () => {
    renderRoutes({ path: '/account', auth: { user: customer, loading: false } });

    expect(screen.getByText('Account Page')).toBeInTheDocument();
  });

  it('redirects a logged-out visitor to /login', () => {
    renderRoutes({ path: '/account', auth: { user: null, loading: false } });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Account Page')).not.toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('shows "Authenticating..." while the session is loading', () => {
    renderRoutes({ path: '/admin', auth: { user: null, loading: true } });

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument(); // no redirect yet
  });

  it('renders the admin page for an admin user', () => {
    renderRoutes({ path: '/admin', auth: { user: admin, loading: false } });

    expect(screen.getByText('Admin Page')).toBeInTheDocument();
  });

  it('redirects a logged-in customer to the home page', () => {
    renderRoutes({ path: '/admin', auth: { user: customer, loading: false } });

    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
  });

  it('redirects a logged-out visitor to the home page', () => {
    renderRoutes({ path: '/admin', auth: { user: null, loading: false } });

    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
  });
});