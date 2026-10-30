import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../../components/ProductCard.jsx';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCart: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../Context/AuthContext.jsx', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../Context/CartContext.jsx', () => ({ useCart: mocks.useCart }));

// keep the real Link/MemoryRouter, replace useNavigate so redirects can be asserted
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const product = {
  _id: 'p1',
  name: 'Keyboard',
  image: 'kb.png',
  category: 'electronics',
  description: 'Mechanical keyboard',
  price: 500,
  stock: 10,
};

const renderCard = (overrides = {}) =>
  render(
    <MemoryRouter>
      <ProductCard product={{ ...product, ...overrides }} />
    </MemoryRouter>
  );

const getAddButton = () => screen.getByRole('button', { name: /add to cart|adding/i });

describe('ProductCard', () => {
  let addToCart;

  const setup = ({ user = { name: 'Test User' } } = {}) => {
    mocks.useAuth.mockReturnValue({ user });
    mocks.useCart.mockReturnValue({ addToCart });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    addToCart = vi.fn().mockResolvedValue(undefined);
    setup();
  });

  describe('display', () => {
    it('shows the name, category, description and price with 2 decimals', () => {
      renderCard();

      expect(screen.getByRole('heading', { name: 'Keyboard' })).toBeInTheDocument();
      expect(screen.getByText('electronics')).toBeInTheDocument();
      expect(screen.getByText('Mechanical keyboard')).toBeInTheDocument();
      expect(screen.getByText('₹500.00')).toBeInTheDocument();
    });

    it('shows the product image with the name as alt text', () => {
      renderCard();

      expect(screen.getByAltText('Keyboard')).toHaveAttribute('src', 'kb.png');
    });

    it('links both the image and the name to the product page', () => {
      renderCard();

      const links = screen.getAllByRole('link', { name: 'Keyboard' });

      expect(links).toHaveLength(2);
      links.forEach((link) => expect(link).toHaveAttribute('href', '/product/p1'));
    });

    it('shows the stock count when the product is in stock', () => {
      renderCard({ stock: 10 });

      expect(screen.getByText('10 in stock')).toBeInTheDocument();
      expect(getAddButton()).toBeEnabled();
    });

    it('shows "Out of Stock" and disables the button when stock is 0', () => {
      renderCard({ stock: 0 });

      expect(screen.getByText('Out of Stock')).toBeInTheDocument();
      expect(getAddButton()).toBeDisabled();
    });
  });

  describe('adding to cart', () => {
    it('redirects a logged-out visitor to /login without calling addToCart', async () => {
      setup({ user: null });
      renderCard();

      await userEvent.click(getAddButton());

      expect(mocks.navigate).toHaveBeenCalledWith('/login');
      expect(addToCart).not.toHaveBeenCalled();
    });

    it('adds 1 item for a logged-in user and shows a success message', async () => {
      renderCard();

      await userEvent.click(getAddButton());

      expect(addToCart).toHaveBeenCalledWith('p1', 1);
      expect(await screen.findByText('Added to cart')).toBeInTheDocument();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('shows "Adding..." and disables the button until the request finishes', async () => {
      let resolveAdd;
      addToCart.mockReturnValue(new Promise((resolve) => { resolveAdd = resolve; }));
      renderCard();

      await userEvent.click(getAddButton());

      expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();

      resolveAdd();

      expect(await screen.findByText('Added to cart')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add to cart/i })).toBeEnabled();
    });

    it('shows the server error message when adding fails', async () => {
      addToCart.mockRejectedValue({ response: { data: { message: 'Only 2 items in stock.' } } });
      renderCard();

      await userEvent.click(getAddButton());

      expect(await screen.findByText('Only 2 items in stock.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add to cart/i })).toBeEnabled();
    });

    it('shows a generic message when the error has no server response', async () => {
      addToCart.mockRejectedValue(new Error('Network Error'));
      renderCard();

      await userEvent.click(getAddButton());

      expect(await screen.findByText('Could not add to cart')).toBeInTheDocument();
    });

    it('clears the previous error message when the user tries again', async () => {
      addToCart.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined);
      renderCard();

      await userEvent.click(getAddButton());
      expect(await screen.findByText('Could not add to cart')).toBeInTheDocument();

      await userEvent.click(getAddButton());

      expect(await screen.findByText('Added to cart')).toBeInTheDocument();
      expect(screen.queryByText('Could not add to cart')).not.toBeInTheDocument();
    });

    it('does not call addToCart when the product is out of stock', async () => {
      renderCard({ stock: 0 });

      await userEvent.click(getAddButton());

      expect(addToCart).not.toHaveBeenCalled();
    });
  });
});