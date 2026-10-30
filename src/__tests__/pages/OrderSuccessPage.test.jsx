import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderSuccessPage from '../../pages/OrderSuccessPage.jsx';
import API from '../../api/axiosInstance.js';

const mocks = vi.hoisted(() => ({ useCart: vi.fn() }));

vi.mock('../../api/axiosInstance.js', () => ({ default: { get: vi.fn() } }));
vi.mock('../../Context/CartContext.jsx', () => ({ useCart: mocks.useCart }));

const makeOrder = (overrides = {}) => ({
  _id: 'o1',
  isPaid: false,
  paymentMethod: 'DIRECT',
  status: 'processing',
  totalAmount: 1250,
  orderItems: [
    { product: 'p1', name: 'Keyboard', image: 'kb.png', price: 500, quantity: 2 },
    { product: 'p2', name: 'Mouse', image: 'mouse.png', price: 250, quantity: 1 },
  ],
  shippingAddress: {
    fullName: 'Test User',
    street: '12 MG Road',
    city: 'Ahmedabad',
    postalCode: '380001',
    phone: '9999999999',
  },
  ...overrides,
});

const renderPage = ({ strict = false } = {}) => {
  const ui = (
    <MemoryRouter initialEntries={['/order-success/o1']}>
      <Routes>
        <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{ui}</StrictMode> : ui);
};

// waits until the order has loaded
const renderLoaded = async (options) => {
  const result = renderPage(options);
  await screen.findByRole('heading', { name: 'Thank you for your order!' });
  return result;
};

describe('OrderSuccessPage', () => {
  let clearCart;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCart = vi.fn().mockResolvedValue(undefined);
    mocks.useCart.mockReturnValue({ clearCart });
    API.get.mockResolvedValue({ data: makeOrder() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loading and not found', () => {
    it('shows a loading message while the order is being fetched', () => {
      API.get.mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByText('Loading order...')).toBeInTheDocument();
    });

    it('shows "Order not found." with a link back to the products when loading fails', async () => {
      API.get.mockRejectedValue(new Error('404'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderPage();

      expect(await screen.findByText('Order not found.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/products');
      expect(consoleSpy).toHaveBeenCalled();
      expect(clearCart).not.toHaveBeenCalled();
    });
  });

  describe('order details', () => {
    it('fetches the order from the URL id and shows the confirmation heading and id', async () => {
      await renderLoaded();

      expect(API.get).toHaveBeenCalledWith('/orders/o1');
      expect(screen.getByText('o1')).toBeInTheDocument();
      expect(screen.getByText('processing')).toBeInTheDocument();
    });

    it('lists the items with images, quantities and line totals, plus the order total', async () => {
      await renderLoaded();

      expect(screen.getByAltText('Keyboard')).toHaveAttribute('src', 'kb.png');
      expect(screen.getByText('Keyboard')).toBeInTheDocument();
      expect(screen.getByText('x 2')).toBeInTheDocument();
      expect(screen.getByText('₹1000.00')).toBeInTheDocument(); // 500 x 2
      expect(screen.getByText('Mouse')).toBeInTheDocument();
      expect(screen.getByText('₹250.00')).toBeInTheDocument();
      expect(screen.getByText('₹1250.00')).toBeInTheDocument(); // total
    });

    it('shows the shipping address', async () => {
      await renderLoaded();

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('12 MG Road')).toBeInTheDocument();
      expect(screen.getByText('Ahmedabad - 380001')).toBeInTheDocument();
      expect(screen.getByText('Phone: 9999999999')).toBeInTheDocument();
    });

    it('has a "Continue shopping" link to the products page', async () => {
      await renderLoaded();

      expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/products');
    });
  });

  describe('payment status label', () => {
    it('shows "Paid" in green for a paid order', async () => {
      API.get.mockResolvedValue({ data: makeOrder({ isPaid: true, paymentMethod: 'RAZORPAY' }) });

      await renderLoaded();

      expect(screen.getByText('Paid')).toHaveClass('text-green-600');
    });

    it('shows "Payment pending" in amber for an unpaid Razorpay order', async () => {
      API.get.mockResolvedValue({ data: makeOrder({ paymentMethod: 'RAZORPAY' }) });

      await renderLoaded();

      expect(screen.getByText('Payment pending')).toHaveClass('text-amber-600');
    });

    it('shows "Direct order (no online payment)" for a direct order', async () => {
      await renderLoaded();

      expect(screen.getByText('Direct order (no online payment)')).toHaveClass('text-amber-600');
    });
  });

  describe('clearing the cart', () => {
    it('clears the cart for a direct order', async () => {
      await renderLoaded();

      expect(clearCart).toHaveBeenCalledTimes(1);
    });

    it('clears the cart for a paid Razorpay order', async () => {
      API.get.mockResolvedValue({ data: makeOrder({ isPaid: true, paymentMethod: 'RAZORPAY' }) });

      await renderLoaded();

      expect(clearCart).toHaveBeenCalledTimes(1);
    });

    it('keeps the cart when a Razorpay payment is still pending', async () => {
      API.get.mockResolvedValue({ data: makeOrder({ paymentMethod: 'RAZORPAY', isPaid: false }) });

      await renderLoaded();

      expect(clearCart).not.toHaveBeenCalled();
    });

    it('clears the cart only once even if the effect runs twice (React StrictMode)', async () => {
      await renderLoaded({ strict: true });

      expect(clearCart).toHaveBeenCalledTimes(1);
    });

    it('still shows the order when clearing the cart fails', async () => {
      clearCart.mockRejectedValue(new Error('Cart not found'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await renderLoaded();

      expect(screen.getByText('Phone: 9999999999')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith('Cart clear skipped:', 'Cart not found');
    });
  });
});