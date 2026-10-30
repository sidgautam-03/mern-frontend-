import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductPage from '../../pages/ProductPage.jsx';
import API from '../../api/axiosInstance.js';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCart: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../api/axiosInstance.js', () => ({ default: { get: vi.fn() } }));
vi.mock('../../Context/AuthContext.jsx', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../Context/CartContext.jsx', () => ({ useCart: mocks.useCart }));

// keep the real router (so useParams works), replace useNavigate to assert redirects
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const product = {
  _id: 'p1',
  name: 'Keyboard',
  category: 'electronics',
  description: 'Mechanical keyboard',
  price: 500,
  stock: 3,
  image: 'kb.png',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/product/p1']}>
      <Routes>
        <Route path="/product/:id" element={<ProductPage />} />
      </Routes>
    </MemoryRouter>
  );

const renderLoaded = async () => {
  renderPage();
  await screen.findByRole('heading', { name: 'Keyboard' });
};

const plusButton = () => screen.getByRole('button', { name: '+' });
const minusButton = () => screen.getByRole('button', { name: '−' }); // the real minus sign (U+2212)
const addToCartButton = () => screen.getByRole('button', { name: /add to cart/i });

describe('ProductPage', () => {
  let addToCart;

  const setup = ({ user = { name: 'Test User' } } = {}) => {
    mocks.useAuth.mockReturnValue({ user });
    mocks.useCart.mockReturnValue({ addToCart });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    addToCart = vi.fn().mockResolvedValue(undefined);
    setup();
    API.get.mockResolvedValue({ data: product });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loading and not found', () => {
    it('shows a loading message while fetching', () => {
      API.get.mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByText('Loading product details...')).toBeInTheDocument();
    });

    it('shows "Product not found." and logs the error when loading fails', async () => {
      API.get.mockRejectedValue(new Error('404'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderPage();

      expect(await screen.findByText('Product not found.')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('product details', () => {
    it('fetches the product from the URL id and shows its details', async () => {
      await renderLoaded();

      expect(API.get).toHaveBeenCalledWith('/products/p1');
      expect(screen.getByText('electronics')).toBeInTheDocument();
      expect(screen.getByText('₹500')).toBeInTheDocument();
      expect(screen.getByText('Mechanical keyboard')).toBeInTheDocument();
      expect(screen.getByAltText('Keyboard')).toHaveAttribute('src', 'kb.png');
    });

    it('shows the stock in green when the product is available', async () => {
      await renderLoaded();

      expect(screen.getByText('3 in stock')).toHaveClass('text-green-600');
    });

    it('goes back one page when Back is clicked', async () => {
      await renderLoaded();

      await userEvent.click(screen.getByRole('button', { name: /back/i }));

      expect(mocks.navigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('out of stock', () => {
    beforeEach(() => {
      API.get.mockResolvedValue({ data: { ...product, stock: 0 } });
    });

    it('shows "Out of stock" in red', async () => {
      await renderLoaded();

      expect(screen.getByText('Out of stock')).toHaveClass('text-red-600');
    });

    it('hides the quantity selector and the Add to cart button', async () => {
      await renderLoaded();

      expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument();
    });
  });

  describe('quantity selector', () => {
    it('starts at 1', async () => {
      await renderLoaded();

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('increases with + and decreases with −', async () => {
      await renderLoaded();

      await userEvent.click(plusButton());
      expect(screen.getByText('2')).toBeInTheDocument();

      await userEvent.click(minusButton());
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('never goes below 1', async () => {
      await renderLoaded();

      await userEvent.click(minusButton());

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('never goes above the available stock', async () => {
      await renderLoaded(); // stock is 3

      await userEvent.click(plusButton());
      await userEvent.click(plusButton());
      await userEvent.click(plusButton());
      await userEvent.click(plusButton());

      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('adding to cart', () => {
    it('sends a logged-out visitor to /login without adding anything', async () => {
      setup({ user: null });
      await renderLoaded();

      await userEvent.click(addToCartButton());

      expect(mocks.navigate).toHaveBeenCalledWith('/login');
      expect(addToCart).not.toHaveBeenCalled();
    });

    it('adds the selected quantity and shows a confirmation', async () => {
      await renderLoaded();
      await userEvent.click(plusButton());
      await userEvent.click(plusButton());

      await userEvent.click(addToCartButton());

      expect(addToCart).toHaveBeenCalledWith('p1', 3);
      expect(await screen.findByText('Added to cart')).toBeInTheDocument();
    });

    it('shows the server message when adding fails', async () => {
      addToCart.mockRejectedValue({ response: { data: { message: 'Only 2 items in stock.' } } });
      await renderLoaded();

      await userEvent.click(addToCartButton());

      expect(await screen.findByText('Only 2 items in stock.')).toBeInTheDocument();
    });

    it('shows a generic message when the error has no server response', async () => {
      addToCart.mockRejectedValue(new Error('Network Error'));
      await renderLoaded();

      await userEvent.click(addToCartButton());

      expect(await screen.findByText('Could not add to cart')).toBeInTheDocument();
    });
  });
});