import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminDashboard from '../../../pages/admin/AdminDashboard.jsx';
import API from '../../../api/axiosInstance.js';

vi.mock('../../../api/axiosInstance.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const products = [
  { _id: 'p1', name: 'Keyboard', category: 'electronics', price: 500, stock: 10, image: 'kb.png' },
  { _id: 'p2', name: 'Mouse', category: 'accessories', price: 250, stock: 3, image: 'mouse.png' },
  { _id: 'p3', name: 'Cable', category: 'cables', price: 100, stock: 0, image: 'cable.png' },
];

const formValues = {
  name: 'Monitor',
  category: 'electronics',
  price: '1200',
  stock: '7',
  image: 'https://img.test/monitor.png',
  description: 'A 24 inch monitor',
};

// the labels in the form are not linked to the inputs, so fields are found by their name attribute
const field = (container, name) => container.querySelector(`[name="${name}"]`);

const fillForm = async (container, values = formValues) => {
  for (const [name, value] of Object.entries(values)) {
    await userEvent.type(field(container, name), value);
  }
};

const clickCreate = () => userEvent.click(screen.getByRole('button', { name: /create product|creating/i }));

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    API.get.mockResolvedValue({ data: products });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('inventory list', () => {
    it('shows a loading message while products are being fetched', () => {
      API.get.mockReturnValue(new Promise(() => {})); // never resolves

      render(<AdminDashboard />);

      expect(screen.getByText('Loading products...')).toBeInTheDocument();
    });

    it('fetches /products and lists every product with its details', async () => {
      render(<AdminDashboard />);

      expect(await screen.findByText('Inventory (3)')).toBeInTheDocument();
      expect(API.get).toHaveBeenCalledWith('/products');
      expect(screen.getByText('Keyboard')).toBeInTheDocument();
      expect(screen.getByText('Mouse')).toBeInTheDocument();
      expect(screen.getByText('electronics')).toBeInTheDocument();
      expect(screen.getByText('₹500')).toBeInTheDocument();
      expect(screen.getByAltText('Keyboard')).toHaveAttribute('src', 'kb.png');
    });

    it('shows "No products yet." when the inventory is empty', async () => {
      API.get.mockResolvedValue({ data: [] });

      render(<AdminDashboard />);

      expect(await screen.findByText('No products yet.')).toBeInTheDocument();
      expect(screen.getByText('Inventory (0)')).toBeInTheDocument();
    });

    it('shows an error and logs it when products cannot be loaded', async () => {
      API.get.mockRejectedValue(new Error('Network Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<AdminDashboard />);

      expect(await screen.findByText('Could not load products')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();
      expect(screen.getByText('No products yet.')).toBeInTheDocument();
    });

    it('colours the stock: red at 0, amber at 5 or less, green above 5', async () => {
      render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      expect(screen.getByText('0')).toHaveClass('text-red-600');
      expect(screen.getByText('3')).toHaveClass('text-amber-600');
      expect(screen.getByText('10')).toHaveClass('text-green-600');
    });
  });

  describe('create product', () => {
    it('shows the form with a heading and an enabled submit button', async () => {
      render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      expect(screen.getByRole('heading', { name: /admin dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /add new product/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create product/i })).toBeEnabled();
    });

    it('does not submit while required fields are empty', async () => {
      render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await clickCreate();

      expect(API.post).not.toHaveBeenCalled();
    });

    it('posts the form with price and stock as numbers, shows success, clears the form and reloads', async () => {
      API.post.mockResolvedValue({ data: {} });
      const { container } = render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await fillForm(container);
      await clickCreate();

      expect(await screen.findByText('Product created')).toBeInTheDocument();
      expect(API.post).toHaveBeenCalledWith('/products', {
        name: 'Monitor',
        category: 'electronics',
        price: 1200,
        stock: 7,
        image: 'https://img.test/monitor.png',
        description: 'A 24 inch monitor',
      });
      expect(field(container, 'name')).toHaveValue('');
      expect(field(container, 'price')).toHaveValue(null);
      expect(API.get).toHaveBeenCalledTimes(2); // initial load + reload after create
    });

    it('shows "Creating..." and disables the button while the request is pending', async () => {
      let resolvePost;
      API.post.mockReturnValue(new Promise((resolve) => { resolvePost = resolve; }));
      const { container } = render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await fillForm(container);
      await clickCreate();

      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();

      resolvePost({ data: {} });

      expect(await screen.findByText('Product created')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create product/i })).toBeEnabled();
    });

    it('shows the server error and keeps the form values when creating fails', async () => {
      API.post.mockRejectedValue({ response: { data: { message: 'Price cannot be negative' } } });
      const { container } = render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await fillForm(container);
      await clickCreate();

      expect(await screen.findByText('Price cannot be negative')).toBeInTheDocument();
      expect(field(container, 'name')).toHaveValue('Monitor');
      expect(screen.queryByText('Product created')).not.toBeInTheDocument();
    });

    it('shows a generic message when the error has no server response', async () => {
      API.post.mockRejectedValue(new Error('Network Error'));
      const { container } = render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await fillForm(container);
      await clickCreate();

      expect(await screen.findByText('Failed to create product')).toBeInTheDocument();
    });

    it('clears the previous error when the user submits again', async () => {
      API.post.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce({ data: {} });
      const { container } = render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await fillForm(container);
      await clickCreate();
      expect(await screen.findByText('Failed to create product')).toBeInTheDocument();

      await clickCreate();

      expect(await screen.findByText('Product created')).toBeInTheDocument();
      expect(screen.queryByText('Failed to create product')).not.toBeInTheDocument();
    });
  });

  describe('delete product', () => {
    const rowFor = (name) => screen.getByText(name).closest('tr');

    it('asks for confirmation with the product name', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await userEvent.click(within(rowFor('Keyboard')).getByRole('button', { name: /delete/i }));

      expect(confirmSpy).toHaveBeenCalledWith('Delete "Keyboard"? This cannot be undone.');
    });

    it('does nothing when the admin cancels the confirmation', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await userEvent.click(within(rowFor('Keyboard')).getByRole('button', { name: /delete/i }));

      expect(API.delete).not.toHaveBeenCalled();
      expect(screen.getByText('Keyboard')).toBeInTheDocument();
    });

    it('deletes the product, removes its row and shows a success message', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      API.delete.mockResolvedValue({ data: {} });
      render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await userEvent.click(within(rowFor('Keyboard')).getByRole('button', { name: /delete/i }));

      expect(await screen.findByText('Product deleted')).toBeInTheDocument();
      expect(API.delete).toHaveBeenCalledWith('/products/p1');
      expect(screen.queryByText('Keyboard')).not.toBeInTheDocument();
      expect(screen.getByText('Mouse')).toBeInTheDocument();
      expect(screen.getByText('Inventory (2)')).toBeInTheDocument();
    });

    it('shows the server error and keeps the row when deleting fails', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      API.delete.mockRejectedValue({ response: { data: { message: 'Product not found' } } });
      render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await userEvent.click(within(rowFor('Mouse')).getByRole('button', { name: /delete/i }));

      expect(await screen.findByText('Product not found')).toBeInTheDocument();
      expect(screen.getByText('Mouse')).toBeInTheDocument();
      expect(screen.queryByText('Product deleted')).not.toBeInTheDocument();
    });

    it('shows a generic message when the delete error has no server response', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      API.delete.mockRejectedValue(new Error('Network Error'));
      render(<AdminDashboard />);
      await screen.findByText('Inventory (3)');

      await userEvent.click(within(rowFor('Mouse')).getByRole('button', { name: /delete/i }));

      expect(await screen.findByText('Failed to delete product')).toBeInTheDocument();
    });
  });
});