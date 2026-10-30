import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProductListPage from '../../pages/ProductListPage.jsx';
import API from '../../api/axiosInstance.js';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCart: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../api/axiosInstance.js', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
vi.mock('../../Context/AuthContext.jsx', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../Context/CartContext.jsx', () => ({ useCart: mocks.useCart }));

// keep the real Link/MemoryRouter, replace useNavigate so redirects can be asserted
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const products = [
  {
    _id: 'p1',
    name: 'Keyboard',
    category: 'electronics',
    description: 'Mechanical keyboard',
    price: 500,
    stock: 10,
    image: 'kb.png',
  },
  {
    _id: 'p2',
    name: 'Mouse',
    category: 'accessories',
    description: 'Wireless mouse',
    price: 249.5,
    stock: 5,
    image: 'mouse.png',
  },
  {
    _id: 'p3',
    name: 'Monitor',
    category: 'electronics',
    description: '24 inch monitor',
    price: 1200,
    stock: 0,
    image: 'monitor.png',
  },
];

const customer = { name: 'Test User', role: 'customer' };
const admin = { name: 'Boss', role: 'admin' };

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProductListPage />
    </MemoryRouter>
  );

const renderLoaded = async () => {
  renderPage();
  await screen.findByText('Keyboard');
};

// each product card is the nearest ancestor with the "overflow-hidden" class
const cardFor = (name) => screen.getByText(name).closest('.overflow-hidden');
const addButtonIn = (card) => within(card).getByRole('button', { name: /add to cart|adding/i });
const searchBox = () => screen.getByPlaceholderText('Search by name...');
const [categorySelectIndex, sortSelectIndex] = [0, 1];
const selects = () => screen.getAllByRole('combobox');

// requests that carry filter params (the very first request, for categories, has none)
const listCalls = () => API.get.mock.calls.filter(([, config]) => config);

describe('ProductListPage', () => {
  let addToCart;

  const setup = ({ user = customer } = {}) => {
    mocks.useAuth.mockReturnValue({ user });
    mocks.useCart.mockReturnValue({ addToCart });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    addToCart = vi.fn().mockResolvedValue(undefined);
    setup();
    API.get.mockResolvedValue({ data: products });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  describe('loading and display', () => {
    it('shows a heading and a loading message while fetching', () => {
      API.get.mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument();
      expect(screen.getByText('Loading products...')).toBeInTheDocument();
    });

    it('fetches the category list and the product list on load', async () => {
      await renderLoaded();

      expect(API.get).toHaveBeenCalledWith('/products'); // categories
      expect(API.get).toHaveBeenCalledWith('/products', { params: {} }); // list
    });

    it('shows each product with category, description, price, stock and a link to its page', async () => {
      await renderLoaded();

      const card = cardFor('Keyboard');
      expect(within(card).getByText('electronics')).toBeInTheDocument();
      expect(within(card).getByText('Mechanical keyboard')).toBeInTheDocument();
      expect(within(card).getByText('₹500.00')).toBeInTheDocument();
      expect(within(card).getByText('10 in stock')).toBeInTheDocument();
      expect(within(card).getByAltText('Keyboard')).toHaveAttribute('src', 'kb.png');
      expect(within(card).getAllByRole('link', { name: 'Keyboard' })).toHaveLength(2);
      within(card)
        .getAllByRole('link', { name: 'Keyboard' })
        .forEach((link) => expect(link).toHaveAttribute('href', '/product/p1'));
      expect(within(cardFor('Mouse')).getByText('₹249.50')).toBeInTheDocument();
    });

    it('marks an out-of-stock product and disables its Add to Cart button', async () => {
      await renderLoaded();

      const card = cardFor('Monitor');
      expect(within(card).getByText('Out of stock')).toBeInTheDocument();
      expect(addButtonIn(card)).toBeDisabled();
      expect(addButtonIn(cardFor('Keyboard'))).toBeEnabled();
    });

    it('shows "No products found." when the list is empty', async () => {
      API.get.mockResolvedValue({ data: [] });

      renderPage();

      expect(await screen.findByText('No products found.')).toBeInTheDocument();
    });

    it('shows an error and logs it when the products cannot be loaded', async () => {
      API.get.mockRejectedValue(new Error('Network Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderPage();

      expect(
        await screen.findByText('Could not load products. Is the backend running?')
      ).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();
      expect(screen.getByText('No products found.')).toBeInTheDocument();
    });

    it('still lists the products when only the category request fails', async () => {
      API.get.mockImplementation(async (url, config) => {
        if (!config) throw new Error('categories failed');
        return { data: products };
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await renderLoaded();

      expect(consoleSpy).toHaveBeenCalled();
      expect(screen.getAllByRole('option', { name: /categories/i })).toHaveLength(1);
      expect(screen.queryByRole('option', { name: 'electronics' })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  describe('filters and sorting', () => {
    it('builds the category dropdown from the products', async () => {
      await renderLoaded();

      expect(screen.getByRole('option', { name: 'All categories' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'electronics' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'accessories' })).toBeInTheDocument();
    });

    it('requests only the chosen category', async () => {
      await renderLoaded();

      await userEvent.selectOptions(selects()[categorySelectIndex], 'electronics');

      await waitFor(() =>
        expect(API.get).toHaveBeenLastCalledWith('/products', { params: { category: 'electronics' } })
      );
    });

    it.each([
      ['price_asc', { sortBy: 'price', order: 'asc' }],
      ['price_desc', { sortBy: 'price', order: 'desc' }],
      ['name_asc', { sortBy: 'name', order: 'asc' }],
    ])('requests the "%s" sort order', async (value, expected) => {
      await renderLoaded();

      await userEvent.selectOptions(selects()[sortSelectIndex], value);

      await waitFor(() => expect(API.get).toHaveBeenLastCalledWith('/products', { params: expected }));
    });

    it('goes back to no sort params when "Newest first" is chosen again', async () => {
      await renderLoaded();
      await userEvent.selectOptions(selects()[sortSelectIndex], 'price_asc');
      await waitFor(() =>
        expect(API.get).toHaveBeenLastCalledWith('/products', { params: { sortBy: 'price', order: 'asc' } })
      );

      await userEvent.selectOptions(selects()[sortSelectIndex], 'newest');

      await waitFor(() => expect(API.get).toHaveBeenLastCalledWith('/products', { params: {} }));
    });

    it('waits for the user to stop typing, then searches once with the keyword', async () => {
      await renderLoaded();

      await userEvent.type(searchBox(), 'key');

      await waitFor(() =>
        expect(API.get).toHaveBeenCalledWith('/products', { params: { keyword: 'key' } })
      );
      const keywordCalls = listCalls().filter(([, config]) => config.params.keyword);
      expect(keywordCalls).toHaveLength(1); // not one request per key press
    });

    it('trims spaces around the keyword', async () => {
      await renderLoaded();

      await userEvent.type(searchBox(), '  mouse  ');

      await waitFor(() =>
        expect(API.get).toHaveBeenCalledWith('/products', { params: { keyword: 'mouse' } })
      );
    });

    it('combines keyword, category and sort in one request', async () => {
      await renderLoaded();

      await userEvent.selectOptions(selects()[categorySelectIndex], 'electronics');
      await userEvent.selectOptions(selects()[sortSelectIndex], 'price_desc');
      await userEvent.type(searchBox(), 'key');

      await waitFor(() =>
        expect(API.get).toHaveBeenLastCalledWith('/products', {
          params: { sortBy: 'price', order: 'desc', keyword: 'key', category: 'electronics' },
        })
      );
    });
  });

  // -------------------------------------------------------------------
  describe('add to cart', () => {
    it('sends a logged-out visitor to /login without adding anything', async () => {
      setup({ user: null });
      await renderLoaded();

      await userEvent.click(addButtonIn(cardFor('Keyboard')));

      expect(mocks.navigate).toHaveBeenCalledWith('/login');
      expect(addToCart).not.toHaveBeenCalled();
    });

    it('adds 1 item for a logged-in user and shows a notice', async () => {
      await renderLoaded();

      await userEvent.click(addButtonIn(cardFor('Keyboard')));

      expect(addToCart).toHaveBeenCalledWith('p1', 1);
      expect(await screen.findByText('Keyboard added to cart')).toBeInTheDocument();
    });

    it('shows "Adding..." only on the card being added, then restores the button', async () => {
      let finish;
      addToCart.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      await renderLoaded();

      await userEvent.click(addButtonIn(cardFor('Keyboard')));

      expect(within(cardFor('Keyboard')).getByRole('button', { name: /adding/i })).toBeDisabled();
      expect(addButtonIn(cardFor('Mouse'))).toBeEnabled();

      finish();

      expect(await screen.findByText('Keyboard added to cart')).toBeInTheDocument();
      expect(within(cardFor('Keyboard')).getByRole('button', { name: /add to cart/i })).toBeEnabled();
    });

    it('shows the server message when adding fails', async () => {
      addToCart.mockRejectedValue({ response: { data: { message: 'Only 2 items in stock.' } } });
      await renderLoaded();

      await userEvent.click(addButtonIn(cardFor('Keyboard')));

      expect(await screen.findByText('Only 2 items in stock.')).toBeInTheDocument();
    });

    it('shows a generic message when the error has no server response', async () => {
      addToCart.mockRejectedValue(new Error('Network Error'));
      await renderLoaded();

      await userEvent.click(addButtonIn(cardFor('Keyboard')));

      expect(await screen.findByText('Could not add to cart')).toBeInTheDocument();
    });

    it(
      'hides the notice after 3 seconds',
      async () => {
        await renderLoaded();
        await userEvent.click(addButtonIn(cardFor('Keyboard')));
        expect(await screen.findByText('Keyboard added to cart')).toBeInTheDocument();

        await waitFor(() => expect(screen.queryByText('Keyboard added to cart')).not.toBeInTheDocument(), {
          timeout: 4500,
        });
      },
      10000
    );
  });

  // -------------------------------------------------------------------
  describe('admin tools', () => {
    it('hides the admin controls from a normal customer', async () => {
      await renderLoaded();

      expect(screen.queryByRole('link', { name: 'Add product' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('shows Add product, Edit and Delete to an admin', async () => {
      setup({ user: admin });
      await renderLoaded();

      expect(screen.getByRole('link', { name: 'Add product' })).toHaveAttribute('href', '/admin/products/new');
      expect(within(cardFor('Keyboard')).getByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        '/admin/products/p1/edit'
      );
      expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(3);
    });

    it('does nothing when the admin cancels the delete confirmation', async () => {
      setup({ user: admin });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await renderLoaded();

      await userEvent.click(within(cardFor('Keyboard')).getByRole('button', { name: 'Delete' }));

      expect(confirmSpy).toHaveBeenCalledWith('Delete "Keyboard"?');
      expect(API.delete).not.toHaveBeenCalled();
      expect(screen.getByText('Keyboard')).toBeInTheDocument();
    });

    it('deletes the product and removes its card when confirmed', async () => {
      setup({ user: admin });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      API.delete.mockResolvedValue({ data: {} });
      await renderLoaded();

      await userEvent.click(within(cardFor('Keyboard')).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByText('Keyboard')).not.toBeInTheDocument());
      expect(API.delete).toHaveBeenCalledWith('/products/p1');
      expect(screen.getByText('Mouse')).toBeInTheDocument();
    });

    it('shows the server message and keeps the card when deleting fails', async () => {
      setup({ user: admin });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      API.delete.mockRejectedValue({ response: { data: { message: 'Product is in an order' } } });
      await renderLoaded();

      await userEvent.click(within(cardFor('Keyboard')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Product is in an order')).toBeInTheDocument();
      expect(screen.getByText('Keyboard')).toBeInTheDocument();
    });

    it('shows a generic message when the delete error has no server response', async () => {
      setup({ user: admin });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      API.delete.mockRejectedValue(new Error('Network Error'));
      await renderLoaded();

      await userEvent.click(within(cardFor('Keyboard')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Failed to delete product')).toBeInTheDocument();
    });
  });
});