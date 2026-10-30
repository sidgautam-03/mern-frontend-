import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartItem from '../../components/CartItems.jsx';

// CartItem only needs updateQuantity / removeFromCart, so the cart context is mocked
const mocks = vi.hoisted(() => ({ useCart: vi.fn() }));

vi.mock('../../Context/CartContext.jsx', () => ({ useCart: mocks.useCart }));

const makeItem = (overrides = {}) => ({
  product: {
    _id: 'p1',
    name: 'Keyboard',
    image: 'kb.png',
    price: 500,
    stock: 10,
    ...overrides.product,
  },
  quantity: 2,
  ...overrides.item,
});

describe('CartItem', () => {
  let updateQuantity;
  let removeFromCart;

  beforeEach(() => {
    vi.clearAllMocks();
    updateQuantity = vi.fn();
    removeFromCart = vi.fn();
    mocks.useCart.mockReturnValue({ updateQuantity, removeFromCart });
  });

  it('renders nothing when the product was deleted (populate returned null)', () => {
    const { container } = render(<CartItem item={{ product: null, quantity: 1 }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the product name, image, unit price, quantity and line total', () => {
    render(<CartItem item={makeItem()} />);

    expect(screen.getByText('Keyboard')).toBeInTheDocument();
    expect(screen.getByAltText('Keyboard')).toHaveAttribute('src', 'kb.png');
    expect(screen.getByText('₹500.00 each')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('₹1000.00')).toBeInTheDocument(); // 500 x 2
  });

  it('formats prices with 2 decimals', () => {
    render(<CartItem item={makeItem({ product: { price: 99.5 }, item: { quantity: 3 } })} />);

    expect(screen.getByText('₹99.50 each')).toBeInTheDocument();
    expect(screen.getByText('₹298.50')).toBeInTheDocument();
  });

  describe('quantity buttons', () => {
    // buttons in DOM order: minus, plus, remove
    const getButtons = () => {
      const [minus, plus] = screen.getAllByRole('button');
      return { minus, plus };
    };

    it('minus calls updateQuantity with quantity - 1', async () => {
      render(<CartItem item={makeItem()} />);

      await userEvent.click(getButtons().minus);

      expect(updateQuantity).toHaveBeenCalledWith('p1', 1);
    });

    it('plus calls updateQuantity with quantity + 1', async () => {
      render(<CartItem item={makeItem()} />);

      await userEvent.click(getButtons().plus);

      expect(updateQuantity).toHaveBeenCalledWith('p1', 3);
    });

    it('disables minus at quantity 1 and does not call updateQuantity', async () => {
      render(<CartItem item={makeItem({ item: { quantity: 1 } })} />);
      const { minus } = getButtons();

      expect(minus).toBeDisabled();
      await userEvent.click(minus);

      expect(updateQuantity).not.toHaveBeenCalled();
    });

    it('enables minus when quantity is above 1', () => {
      render(<CartItem item={makeItem({ item: { quantity: 2 } })} />);

      expect(getButtons().minus).toBeEnabled();
    });

    it('disables plus when quantity reaches the available stock', async () => {
      render(<CartItem item={makeItem({ product: { stock: 2 }, item: { quantity: 2 } })} />);
      const { plus } = getButtons();

      expect(plus).toBeDisabled();
      await userEvent.click(plus);

      expect(updateQuantity).not.toHaveBeenCalled();
    });

    it('enables plus while quantity is below stock', () => {
      render(<CartItem item={makeItem({ product: { stock: 3 }, item: { quantity: 2 } })} />);

      expect(getButtons().plus).toBeEnabled();
    });
  });

  it('calls removeFromCart with the product id when the remove button is clicked', async () => {
    render(<CartItem item={makeItem()} />);

    await userEvent.click(screen.getByTitle('Remove item'));

    expect(removeFromCart).toHaveBeenCalledTimes(1);
    expect(removeFromCart).toHaveBeenCalledWith('p1');
  });
});