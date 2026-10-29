import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductFormPage from '../../../pages/admin/ProductFormPage.jsx';
import API from '../../../api/axiosInstance.js';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('../../../api/axiosInstance.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// keep the real router (so useParams works), replace useNavigate to assert redirects
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const existingProduct = {
  _id: 'p1',
  name: 'Keyboard',
  price: 500,
  description: 'Mechanical keyboard',
  image: 'https://img.test/kb.png',
  category: 'electronics',
  stock: 10,
};

const validValues = {
  name: 'Monitor',
  category: 'electronics',
  price: '1200',
  stock: '7',
  image: 'https://img.test/monitor.png',
  description: 'A 24 inch monitor',
};

// "/product/new" has no :id (add mode); "/product/p1/edit" has one (edit mode)
const renderForm = (path = '/product/new') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/product/new" element={<ProductFormPage />} />
        <Route path="/product/:id/edit" element={<ProductFormPage />} />
      </Routes>
    </MemoryRouter>
  );

// labels are not linked to the inputs, so fields are found by their name attribute
const field = (container, name) => container.querySelector(`[name="${name}"]`);

const fillForm = async (container, overrides = {}) => {
  const values = { ...validValues, ...overrides };
  for (const [name, value] of Object.entries(values)) {
    await userEvent.type(field(container, name), value);
  }
};

const clickSubmit = () =>
  userEvent.click(screen.getByRole('button', { name: /create product|update product|saving/i }));

describe('ProductFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  describe('add mode', () => {
    it('shows an empty "Add new product" form without a Delete button', () => {
      const { container } = renderForm();

      expect(screen.getByRole('heading', { name: 'Add new product' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create product' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
      expect(field(container, 'name')).toHaveValue('');
      expect(API.get).not.toHaveBeenCalled();
    });

    it('goes back one page when Back is clicked', async () => {
      renderForm();

      await userEvent.click(screen.getByRole('button', { name: /back/i }));

      expect(mocks.navigate).toHaveBeenCalledWith(-1);
    });

    describe('validation', () => {
      it('shows every error and sends nothing when the form is empty', async () => {
        renderForm();

        await clickSubmit();

        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
        expect(screen.getByText('Category is required')).toBeInTheDocument();
        expect(screen.getByText('Enter a valid price (0 or more)')).toBeInTheDocument();
        expect(screen.getByText('Stock must be a whole number (0 or more)')).toBeInTheDocument();
        expect(screen.getByText('Enter a valid image URL')).toBeInTheDocument();
        expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
        expect(API.post).not.toHaveBeenCalled();
      });

      it.each([
        ['name', 'M', 'Name must be at least 2 characters'],
        ['category', '   ', 'Category is required'],
        ['price', '-5', 'Enter a valid price (0 or more)'],
        ['stock', '2.5', 'Stock must be a whole number (0 or more)'],
        ['stock', '-1', 'Stock must be a whole number (0 or more)'],
        ['image', 'notaurl', 'Enter a valid image URL'],
        ['description', 'too short', 'Description must be at least 10 characters'],
      ])('rejects an invalid %s ("%s")', async (name, value, message) => {
        const { container } = renderForm();

        await fillForm(container, { [name]: value });
        await clickSubmit();

        expect(screen.getByText(message)).toBeInTheDocument();
        expect(API.post).not.toHaveBeenCalled();
      });

      it('clears a field error as soon as the user edits that field', async () => {
        const { container } = renderForm();
        await clickSubmit();
        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();

        await userEvent.type(field(container, 'name'), 'M');

        expect(screen.queryByText('Name must be at least 2 characters')).not.toBeInTheDocument();
        expect(screen.getByText('Category is required')).toBeInTheDocument(); // others stay
      });
    });

    describe('image preview', () => {
      it('shows a preview once the image URL is valid', async () => {
        const { container } = renderForm();

        await userEvent.type(field(container, 'image'), 'https://img.test/x.png');

        expect(screen.getByAltText('Preview')).toHaveAttribute('src', 'https://img.test/x.png');
      });

      it('shows no preview for an invalid URL', async () => {
        const { container } = renderForm();

        await userEvent.type(field(container, 'image'), 'notaurl');

        expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
      });
    });

    describe('submitting', () => {
      it('posts a trimmed payload with numeric price/stock and redirects to /products', async () => {
        API.post.mockResolvedValue({ data: {} });
        const { container } = renderForm();

        await fillForm(container, { name: '  Monitor  ', category: ' electronics ' });
        await clickSubmit();

        expect(API.post).toHaveBeenCalledWith('/products', {
          name: 'Monitor',
          category: 'electronics',
          description: 'A 24 inch monitor',
          image: 'https://img.test/monitor.png',
          price: 1200,
          stock: 7,
        });
        expect(API.put).not.toHaveBeenCalled();
        expect(mocks.navigate).toHaveBeenCalledWith('/products');
      });

      it('shows "Saving..." and disables the button while the request is pending', async () => {
        let resolvePost;
        API.post.mockReturnValue(new Promise((resolve) => { resolvePost = resolve; }));
        const { container } = renderForm();

        await fillForm(container);
        await clickSubmit();

        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

        resolvePost({ data: {} });

        expect(await screen.findByRole('button', { name: 'Create product' })).toBeEnabled();
      });

      it('shows the server error and stays on the page when saving fails', async () => {
        API.post.mockRejectedValue({ response: { data: { message: 'Name already exists' } } });
        const { container } = renderForm();

        await fillForm(container);
        await clickSubmit();

        expect(await screen.findByText('Name already exists')).toBeInTheDocument();
        expect(mocks.navigate).not.toHaveBeenCalled();
      });

      it('shows a generic message when the error has no server response', async () => {
        API.post.mockRejectedValue(new Error('Network Error'));
        const { container } = renderForm();

        await fillForm(container);
        await clickSubmit();

        expect(await screen.findByText('Failed to save product')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------
  describe('edit mode', () => {
    beforeEach(() => {
      API.get.mockResolvedValue({ data: existingProduct });
    });

    it('shows a loading message while the product is being fetched', () => {
      API.get.mockReturnValue(new Promise(() => {}));

      renderForm('/product/p1/edit');

      expect(screen.getByText('Loading product...')).toBeInTheDocument();
    });

    it('loads the product and pre-fills the form', async () => {
      const { container } = renderForm('/product/p1/edit');

      expect(await screen.findByRole('heading', { name: 'Edit product' })).toBeInTheDocument();
      expect(API.get).toHaveBeenCalledWith('/products/p1');
      expect(field(container, 'name')).toHaveValue('Keyboard');
      expect(field(container, 'category')).toHaveValue('electronics');
      expect(field(container, 'price')).toHaveValue(500);
      expect(field(container, 'stock')).toHaveValue(10);
      expect(field(container, 'image')).toHaveValue('https://img.test/kb.png');
      expect(field(container, 'description')).toHaveValue('Mechanical keyboard');
      expect(screen.getByAltText('Preview')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update product' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    });

    it('shows "Product not found" when the product cannot be loaded', async () => {
      API.get.mockRejectedValue(new Error('404'));

      renderForm('/product/p1/edit');

      expect(await screen.findByText('Product not found')).toBeInTheDocument();
    });

    it('sends a PUT with the edited values and redirects to /products', async () => {
      API.put.mockResolvedValue({ data: {} });
      const { container } = renderForm('/product/p1/edit');
      await screen.findByRole('heading', { name: 'Edit product' });

      await userEvent.clear(field(container, 'price'));
      await userEvent.type(field(container, 'price'), '600');
      await clickSubmit();

      expect(API.put).toHaveBeenCalledWith('/products/p1', {
        name: 'Keyboard',
        category: 'electronics',
        description: 'Mechanical keyboard',
        image: 'https://img.test/kb.png',
        price: 600,
        stock: 10,
      });
      expect(API.post).not.toHaveBeenCalled();
      expect(mocks.navigate).toHaveBeenCalledWith('/products');
    });

    it('shows the server error when updating fails', async () => {
      API.put.mockRejectedValue({ response: { data: { message: 'Update rejected' } } });
      renderForm('/product/p1/edit');
      await screen.findByRole('heading', { name: 'Edit product' });

      await clickSubmit();

      expect(await screen.findByText('Update rejected')).toBeInTheDocument();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    describe('delete', () => {
      it('asks for confirmation with the product name and does nothing if cancelled', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        renderForm('/product/p1/edit');
        await screen.findByRole('heading', { name: 'Edit product' });

        await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

        expect(confirmSpy).toHaveBeenCalledWith('Delete "Keyboard"? This cannot be undone.');
        expect(API.delete).not.toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
      });

      it('deletes the product and redirects to /products when confirmed', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        API.delete.mockResolvedValue({ data: {} });
        renderForm('/product/p1/edit');
        await screen.findByRole('heading', { name: 'Edit product' });

        await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

        expect(API.delete).toHaveBeenCalledWith('/products/p1');
        expect(mocks.navigate).toHaveBeenCalledWith('/products');
      });

      it('shows the server error and stays on the page when deleting fails', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        API.delete.mockRejectedValue({ response: { data: { message: 'Cannot delete' } } });
        renderForm('/product/p1/edit');
        await screen.findByRole('heading', { name: 'Edit product' });

        await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

        expect(await screen.findByText('Cannot delete')).toBeInTheDocument();
        expect(mocks.navigate).not.toHaveBeenCalled();
      });

      it('shows a generic message when the delete error has no server response', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        API.delete.mockRejectedValue(new Error('Network Error'));
        renderForm('/product/p1/edit');
        await screen.findByRole('heading', { name: 'Edit product' });

        await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

        expect(await screen.findByText('Failed to delete product')).toBeInTheDocument();
      });
    });
  });
});