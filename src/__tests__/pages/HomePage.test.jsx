import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../../pages/HomePage.jsx';
import API from '../../api/axiosInstance.js';

vi.mock('../../api/axiosInstance.js', () => ({ default: { get: vi.fn() } }));

// ProductCard has its own tests, so here it is a simple stand-in that shows the product name
vi.mock('../../components/ProductCard.jsx', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ product }) => createElement('div', { 'data-testid': 'product-card' }, product.name),
  };
});

const products = [
  { _id: 'p1', name: 'Keyboard', category: 'electronics', stock: 10 },
  { _id: 'p2', name: 'Mouse', category: 'accessories', stock: 5 },
  { _id: 'p3', name: 'Monitor', category: 'electronics', stock: 0 }, // out of stock
  { _id: 'p4', name: 'Cable', category: 'cables', stock: 20 },
  { _id: 'p5', name: 'Laptop', category: 'electronics', stock: 4 },
  { _id: 'p6', name: 'Speaker', category: 'audio', stock: 2 }, // 5th in-stock item
];

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

// waits until the products have loaded
const renderLoaded = async () => {
  renderHome();
  await screen.findByRole('heading', { name: 'All products' });
  await screen.findAllByTestId('product-card');
};

const featuredSection = () => screen.queryByRole('heading', { name: 'Featured products' })?.closest('section');
const allSection = () => screen.getByRole('heading', { name: 'All products' }).closest('section');
const namesIn = (section) => within(section).queryAllByTestId('product-card').map((el) => el.textContent);
const searchBox = () => screen.getByPlaceholderText('Search products by name...');

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    API.get.mockResolvedValue({ data: products });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hero banner', () => {
    it('shows the headline and a "Shop now" link to the products page', () => {
      API.get.mockReturnValue(new Promise(() => {}));

      renderHome();

      expect(screen.getByRole('heading', { name: 'Shop smart, shop fast' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Shop now' })).toHaveAttribute('href', '/products');
    });
  });

  describe('loading', () => {
    it('shows a loading message and no featured section while fetching', () => {
      API.get.mockReturnValue(new Promise(() => {}));

      renderHome();

      expect(screen.getByText('Loading products...')).toBeInTheDocument();
      expect(featuredSection()).toBeUndefined();
    });

    it('fetches /products once on load', async () => {
      await renderLoaded();

      expect(API.get).toHaveBeenCalledTimes(1);
      expect(API.get).toHaveBeenCalledWith('/products');
      expect(screen.queryByText('Loading products...')).not.toBeInTheDocument();
    });
  });

  describe('featured products', () => {
    it('shows only the first 4 in-stock products', async () => {
      await renderLoaded();

      expect(namesIn(featuredSection())).toEqual(['Keyboard', 'Mouse', 'Cable', 'Laptop']);
    });

    it('is hidden when nothing is in stock', async () => {
      API.get.mockResolvedValue({ data: products.map((p) => ({ ...p, stock: 0 })) });

      await renderLoaded();

      expect(featuredSection()).toBeUndefined();
      expect(namesIn(allSection())).toHaveLength(6);
    });
  });

  describe('all products', () => {
    it('lists every product, including out-of-stock ones', async () => {
      await renderLoaded();

      expect(namesIn(allSection())).toEqual([
        'Keyboard',
        'Mouse',
        'Monitor',
        'Cable',
        'Laptop',
        'Speaker',
      ]);
    });

    it('shows "No products found." when there are no products at all', async () => {
      API.get.mockResolvedValue({ data: [] });

      renderHome();

      expect(await screen.findByText('No products found.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'all' })).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(1); // only the "all" category
    });
  });

  describe('category filter', () => {
    it('builds one button per category plus "all"', async () => {
      await renderLoaded();

      ['all', 'electronics', 'accessories', 'cables', 'audio'].forEach((name) => {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      });
      expect(screen.getAllByRole('button')).toHaveLength(5);
    });

    it('highlights the selected category', async () => {
      await renderLoaded();

      expect(screen.getByRole('button', { name: 'all' })).toHaveClass('bg-blue-600');
      expect(screen.getByRole('button', { name: 'audio' })).not.toHaveClass('bg-blue-600');

      await userEvent.click(screen.getByRole('button', { name: 'audio' }));

      expect(screen.getByRole('button', { name: 'audio' })).toHaveClass('bg-blue-600');
      expect(screen.getByRole('button', { name: 'all' })).not.toHaveClass('bg-blue-600');
    });

    it('shows only products of the chosen category and hides the featured section', async () => {
      await renderLoaded();

      await userEvent.click(screen.getByRole('button', { name: 'electronics' }));

      expect(namesIn(allSection())).toEqual(['Keyboard', 'Monitor', 'Laptop']);
      expect(featuredSection()).toBeUndefined();
    });

    it('brings back every product and the featured section when "all" is chosen again', async () => {
      await renderLoaded();
      await userEvent.click(screen.getByRole('button', { name: 'electronics' }));

      await userEvent.click(screen.getByRole('button', { name: 'all' }));

      expect(namesIn(allSection())).toHaveLength(6);
      expect(featuredSection()).toBeInTheDocument();
    });
  });

  describe('search', () => {
    it('filters by name, ignoring case, and hides the featured section', async () => {
      await renderLoaded();

      await userEvent.type(searchBox(), 'KEY');

      expect(namesIn(allSection())).toEqual(['Keyboard']);
      expect(featuredSection()).toBeUndefined();
    });

    it('ignores spaces around the search term', async () => {
      await renderLoaded();

      await userEvent.type(searchBox(), '  mouse  ');

      expect(namesIn(allSection())).toEqual(['Mouse']);
    });

    it('does not count a whitespace-only search as filtering', async () => {
      await renderLoaded();

      await userEvent.type(searchBox(), '   ');

      expect(namesIn(allSection())).toHaveLength(6);
      expect(featuredSection()).toBeInTheDocument();
    });

    it('combines the search term with the selected category', async () => {
      await renderLoaded();

      await userEvent.click(screen.getByRole('button', { name: 'electronics' }));
      await userEvent.type(searchBox(), 'lap');

      expect(namesIn(allSection())).toEqual(['Laptop']);
    });

    it('shows "No products found." when nothing matches', async () => {
      await renderLoaded();

      await userEvent.type(searchBox(), 'zzz');

      expect(screen.getByText('No products found.')).toBeInTheDocument();
      expect(namesIn(allSection())).toEqual([]);
    });
  });

  describe('when loading fails', () => {
    it('shows an error, logs it and falls back to "No products found."', async () => {
      API.get.mockRejectedValue(new Error('Network Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderHome();

      expect(
        await screen.findByText('Could not load products. Is the backend running?')
      ).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();
      expect(screen.getByText('No products found.')).toBeInTheDocument();
      expect(featuredSection()).toBeUndefined();
    });
  });
});