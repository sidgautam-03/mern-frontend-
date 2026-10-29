import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CartPage from '../../pages/CartPage.jsx';

const mocks = vi.hoisted(() => ({ useCart: vi.fn(), navigate: vi.fn() }));

vi.mock('../../Context/CartContext.jsx', () => ({ useCart: mocks.useCart }));

// keep the real Link/MemoryRouter, replace useNavigate so redirects can be asserted
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const keyboard = { _id: 'p1', name: 'Keyboard', image: 'kb.png', price: 500, stock: 10 };
const mouse = { _id: 'p2', name: 'Mouse', image: 'mouse.png', price: 250, stock: 3 };

const makeCart = (items, overrides = {}) => ({
  items,
  subtotal: 1750,
  totalAmount: 1850,
  ...overrides,
});

const filledCart = makeCart([
  { product: keyboard, quantity: 2 },
  { product: mouse, quantity: 3 },
]);

const renderCartPage = () =>
  render(
    <MemoryRouter>
      <CartPage />
    </MemoryRouter>
  );

describe('CartPage', () => {
  let updateQuantity;
  let removeFromCart;
  let clearCart;

  const setup = (cart = filledCart) => {
    mocks.useCart.mockReturnValue({ cart, updateQuantity, removeFromCart, clearCart });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    updateQuantity = vi.fn().mockResolvedValue(undefined);
    removeFromCart = vi.fn().mockResolvedValue(undefined);
    clearCart = vi.fn().mockResolvedValue(undefined);
    setup();
  });

  // -------------------------------------------------------------------
  describe('empty cart', () => {
    it('shows an empty message with a link to keep shopping', () => {
      setup(makeCart([]));

      renderCartPage();

      expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute(
        'href',
        '/products'
      );
      expect(screen.queryByText('Order summary')).not.toBeInTheDocument();
    });

    it('treats a cart whose products were all deleted as empty', () => {
      setup(makeCart([{ product: null, quantity: 1 }]));

      renderCartPage();

      expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  describe('cart with items', () => {
    it('lists each item with image, link, unit price, quantity and line total', () => {
      renderCartPage();

      expect(screen.getByRole('heading', { name: 'Shopping Cart' })).toBeInTheDocument();
      expect(screen.getByAltText('Keyboard')).toHaveAttribute('src', 'kb.png');
      expect(screen.getByRole('link', { name: 'Keyboard' })).toHaveAttribute('href', '/product/p1');
      expect(screen.getByText('₹500 each')).toBeInTheDocument();
      expect(screen.getByText('₹1000.00')).toBeInTheDocument(); // 500 x 2
      expect(screen.getByText('₹750.00')).toBeInTheDocument(); // 250 x 3
      expect(screen.getByRole('link', { name: 'Mouse' })).toHaveAttribute('href', '/product/p2');
    });

    it('shows the subtotal and total from the cart', () => {
      renderCartPage();

      expect(screen.getByText('Order summary')).toBeInTheDocument();
      expect(screen.getByText('₹1750.00')).toBeInTheDocument();
      expect(screen.getByText('₹1850.00')).toBeInTheDocument();
    });

    it('skips items whose product was deleted but still shows the others', () => {
      setup(makeCart([{ product: null, quantity: 4 }, { product: keyboard, quantity: 2 }]));

      renderCartPage();

      expect(screen.getByText('Keyboard')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Remove item' })).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  describe('item actions', () => {
    it('increase calls updateQuantity with quantity + 1', async () => {
      renderCartPage();

      await userEvent.click(screen.getAllByRole('button', { name: 'Increase quantity' })[0]);

      expect(updateQuantity).toHaveBeenCalledWith('p1', 3);
    });

    it('decrease calls updateQuantity with quantity - 1', async () => {
      renderCartPage();

      await userEvent.click(screen.getAllByRole('button', { name: 'Decrease quantity' })[0]);

      expect(updateQuantity).toHaveBeenCalledWith('p1', 1);
    });

    it('disables decrease at quantity 1', () => {
      setup(makeCart([{ product: keyboard, quantity: 1 }]));

      renderCartPage();

      expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    });

    it('disables increase when the quantity has reached the stock', () => {
      renderCartPage(); // mouse: quantity 3, stock 3

      const increase = screen.getAllByRole('button', { name: 'Increase quantity' });

      expect(increase[0]).toBeEnabled(); // keyboard 2 of 10
      expect(increase[1]).toBeDisabled(); // mouse 3 of 3
    });

    it('remove calls removeFromCart with the product id', async () => {
      renderCartPage();

      await userEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[1]);

      expect(removeFromCart).toHaveBeenCalledWith('p2');
    });

    it('"Clear cart" calls clearCart', async () => {
      renderCartPage();

      await userEvent.click(screen.getByRole('button', { name: 'Clear cart' }));

      expect(clearCart).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------
  describe('busy state', () => {
    it('disables only the affected row while its request is pending', async () => {
      let finish;
      updateQuantity.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      renderCartPage();

      await userEvent.click(screen.getAllByRole('button', { name: 'Increase quantity' })[0]);

      const remove = screen.getAllByRole('button', { name: 'Remove item' });
      expect(remove[0]).toBeDisabled(); // row being updated
      expect(remove[1]).toBeEnabled(); // other row untouched

      finish();

      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove item' })[0]).toBeEnabled());
    });

    it('disables "Clear cart" while the cart is being cleared', async () => {
      let finish;
      clearCart.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      renderCartPage();

      await userEvent.click(screen.getByRole('button', { name: 'Clear cart' }));

      expect(screen.getByRole('button', { name: 'Clear cart' })).toBeDisabled();

      finish();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Clear cart' })).toBeEnabled());
    });
  });

  // -------------------------------------------------------------------
  describe('errors', () => {
    it('shows the server message when an action fails', async () => {
      updateQuantity.mockRejectedValue({ response: { data: { message: 'Only 2 items in stock.' } } });
      renderCartPage();

      await userEvent.click(screen.getAllByRole('button', { name: 'Increase quantity' })[0]);

      expect(await screen.findByText('Only 2 items in stock.')).toBeInTheDocument();
    });

    it('shows a generic message when the error has no server response', async () => {
      removeFromCart.mockRejectedValue(new Error('Network Error'));
      renderCartPage();

      await userEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[0]);

      expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    });

    it('clears the old error when the next action starts', async () => {
      updateQuantity.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined);
      renderCartPage();
      const increase = screen.getAllByRole('button', { name: 'Increase quantity' })[0];

      await userEvent.click(increase);
      expect(await screen.findByText('Something went wrong')).toBeInTheDocument();

      await userEvent.click(increase);

      await waitFor(() => expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument());
    });
  });

  // -------------------------------------------------------------------
  describe('checkout button', () => {
    it('goes to /checkout when every item is within stock', async () => {
      renderCartPage();

      const button = screen.getByRole('button', { name: 'Proceed to checkout' });
      expect(button).toBeEnabled();
      expect(screen.queryByText('Reduce quantities to continue')).not.toBeInTheDocument();

      await userEvent.click(button);

      expect(mocks.navigate).toHaveBeenCalledWith('/checkout');
    });

    it('is disabled and explains why when an item exceeds the stock', async () => {
      setup(makeCart([{ product: { ...mouse, stock: 1 }, quantity: 2 }]));

      renderCartPage();

      expect(screen.getByText('Only 1 left in stock, please reduce quantity')).toBeInTheDocument();
      expect(screen.getByText('Reduce quantities to continue')).toBeInTheDocument();

      const button = screen.getByRole('button', { name: 'Proceed to checkout' });
      expect(button).toBeDisabled();

      await userEvent.click(button);

      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  });
});