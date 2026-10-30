import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CheckoutPage from '../../pages/CheckoutPage.jsx';
import API from '../../api/axiosInstance.js';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCart: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../api/axiosInstance.js', () => ({ default: { post: vi.fn() } }));
vi.mock('../../Context/AuthContext.jsx', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../Context/CartContext.jsx', () => ({ useCart: mocks.useCart }));

// keep the real Link/MemoryRouter, replace useNavigate so redirects can be asserted
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

// ---------- test data ----------
const user = { name: 'Test User', email: 'test@example.com' };
const keyboard = { _id: 'p1', name: 'Keyboard', price: 500, stock: 10 };
const mouse = { _id: 'p2', name: 'Mouse', price: 250, stock: 3 };

const makeCart = (items, overrides = {}) => ({ items, subtotal: 1250, totalAmount: 1300, ...overrides });

const filledCart = makeCart([
  { product: keyboard, quantity: 2 },
  { product: mouse, quantity: 1 },
]);

const addressValues = {
  phone: '9999999999',
  street: '  12 MG Road  ',
  city: 'Ahmedabad',
  postalCode: '380001',
};

const razorpayResponse = {
  order: { _id: 'o1' },
  razorpay: { keyId: 'rzp_test_x', amount: 130000, currency: 'INR', orderId: 'order_rzp_1' },
};

// ---------- helpers ----------
const renderCheckout = () =>
  render(
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>
  );

// labels are not linked to the inputs, so fields are found by their name attribute
const field = (container, name) => container.querySelector(`[name="${name}"]`);

const fillAddress = async (container, values = addressValues) => {
  for (const [name, value] of Object.entries(values)) {
    await userEvent.type(field(container, name), value);
  }
};

const getSubmit = () => screen.getByRole('button', { name: /place order|pay ₹|processing/i });

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user });
    mocks.useCart.mockReturnValue({ cart: filledCart });
  });

  afterEach(() => {
    document.querySelectorAll('script[src*="razorpay"]').forEach((s) => s.remove());
    delete window.Razorpay;
  });

  // -------------------------------------------------------------------
  describe('empty cart', () => {
    it('shows a message and a link back to the products when the cart is empty', () => {
      mocks.useCart.mockReturnValue({ cart: makeCart([]) });

      renderCheckout();

      expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/products');
      expect(screen.queryByRole('heading', { name: 'Checkout' })).not.toBeInTheDocument();
    });

    it('treats a cart whose products were all deleted as empty', () => {
      mocks.useCart.mockReturnValue({ cart: makeCart([{ product: null, quantity: 1 }]) });

      renderCheckout();

      expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  describe('page content', () => {
    it('shows the order summary with line totals, subtotal and final amount', () => {
      renderCheckout();

      expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
      expect(screen.getByText('Keyboard')).toBeInTheDocument();
      expect(screen.getByText('x 2')).toBeInTheDocument();
      expect(screen.getByText('₹1000.00')).toBeInTheDocument(); // 500 x 2
      expect(screen.getByText('₹250.00')).toBeInTheDocument(); // 250 x 1
      expect(screen.getByText('₹1250.00')).toBeInTheDocument(); // subtotal
      expect(screen.getByText('₹1300.00')).toBeInTheDocument(); // final amount
    });

    it('pre-fills the full name from the logged-in user', () => {
      const { container } = renderCheckout();

      expect(field(container, 'fullName')).toHaveValue('Test User');
    });

    it('leaves the full name empty when there is no user', () => {
      mocks.useAuth.mockReturnValue({ user: null });

      const { container } = renderCheckout();

      expect(field(container, 'fullName')).toHaveValue('');
    });

    it('defaults to a direct order and switches the button label for Razorpay', async () => {
      renderCheckout();

      expect(screen.getByRole('radio', { name: /place order directly/i })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Place order' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', { name: /pay online with razorpay/i }));

      expect(screen.getByRole('radio', { name: /pay online with razorpay/i })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Pay ₹1300.00' })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  describe('validation', () => {
    it('shows an error for every missing field and sends nothing', async () => {
      const { container } = renderCheckout();
      await userEvent.clear(field(container, 'fullName'));

      await userEvent.click(getSubmit());

      expect(screen.getByText('Full name is required')).toBeInTheDocument();
      expect(screen.getByText('Enter a 10 digit phone number')).toBeInTheDocument();
      expect(screen.getByText('Street address is required')).toBeInTheDocument();
      expect(screen.getByText('City is required')).toBeInTheDocument();
      expect(screen.getByText('Enter a 6 digit postal code')).toBeInTheDocument();
      expect(API.post).not.toHaveBeenCalled();
    });

    it('rejects a phone number that is not 10 digits', async () => {
      const { container } = renderCheckout();

      await fillAddress(container, { ...addressValues, phone: '12345' });
      await userEvent.click(getSubmit());

      expect(screen.getByText('Enter a 10 digit phone number')).toBeInTheDocument();
      expect(API.post).not.toHaveBeenCalled();
    });

    it('rejects a postal code that is not 6 digits', async () => {
      const { container } = renderCheckout();

      await fillAddress(container, { ...addressValues, postalCode: '123' });
      await userEvent.click(getSubmit());

      expect(screen.getByText('Enter a 6 digit postal code')).toBeInTheDocument();
      expect(API.post).not.toHaveBeenCalled();
    });

    it('clears a field error as soon as the user edits that field', async () => {
      const { container } = renderCheckout();
      await userEvent.click(getSubmit());
      expect(screen.getByText('City is required')).toBeInTheDocument();

      await userEvent.type(field(container, 'city'), 'A');

      expect(screen.queryByText('City is required')).not.toBeInTheDocument();
      expect(screen.getByText('Street address is required')).toBeInTheDocument(); // others stay
    });
  });

  // -------------------------------------------------------------------
  describe('stock problems', () => {
    const lowStockCart = makeCart([{ product: { ...mouse, stock: 1 }, quantity: 3 }]);

    it('lists the affected items, links to the cart and disables the submit button', () => {
      mocks.useCart.mockReturnValue({ cart: lowStockCart });

      renderCheckout();

      expect(screen.getByText('Stock changed for these items:')).toBeInTheDocument();
      expect(screen.getByText('Mouse: you have 3, only 1 available')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Update cart' })).toHaveAttribute('href', '/cart');
      expect(getSubmit()).toBeDisabled();
    });

    it('refuses to place the order even if the form is submitted another way', () => {
      mocks.useCart.mockReturnValue({ cart: lowStockCart });
      const { container } = renderCheckout();

      fireEvent.submit(container.querySelector('form'));

      expect(
        screen.getByText('Some items are out of stock. Please update your cart first.')
      ).toBeInTheDocument();
      expect(API.post).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  describe('direct order', () => {
    it('posts a trimmed address with DIRECT and redirects to the success page', async () => {
      API.post.mockResolvedValue({ data: { order: { _id: 'o1' } } });
      const { container } = renderCheckout();

      await fillAddress(container);
      await userEvent.click(getSubmit());

      expect(API.post).toHaveBeenCalledWith('/orders', {
        shippingAddress: {
          fullName: 'Test User',
          phone: '9999999999',
          street: '12 MG Road',
          city: 'Ahmedabad',
          postalCode: '380001',
        },
        paymentMethod: 'DIRECT',
      });
      expect(mocks.navigate).toHaveBeenCalledWith('/order-success/o1');
    });

    it('shows "Processing..." and disables the button while the order is being placed', async () => {
      API.post.mockReturnValue(new Promise(() => {})); // never resolves
      const { container } = renderCheckout();

      await fillAddress(container);
      await userEvent.click(getSubmit());

      expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
    });

    it('shows the server error and re-enables the button when the order fails', async () => {
      API.post.mockRejectedValue({ response: { data: { message: '"Mouse" just went out of stock.' } } });
      const { container } = renderCheckout();

      await fillAddress(container);
      await userEvent.click(getSubmit());

      expect(await screen.findByText('"Mouse" just went out of stock.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('falls back to the error message, then to a generic message', async () => {
      API.post.mockRejectedValueOnce(new Error('Network Error')).mockRejectedValueOnce({});
      const { container } = renderCheckout();
      await fillAddress(container);

      await userEvent.click(getSubmit());
      expect(await screen.findByText('Network Error')).toBeInTheDocument();

      await userEvent.click(getSubmit());
      expect(await screen.findByText('Could not place order')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  describe('Razorpay payment', () => {
    let rzpOptions;
    let rzpInstance;

    const installRazorpay = () => {
      window.Razorpay = vi.fn(function (options) {
        rzpOptions = options;
        return rzpInstance;
      });
    };

    // choose Razorpay, fill the form and submit
    const startPayment = async (container) => {
      await userEvent.click(screen.getByRole('radio', { name: /pay online with razorpay/i }));
      await fillAddress(container);
      await userEvent.click(getSubmit());
    };

    beforeEach(() => {
      rzpOptions = undefined;
      rzpInstance = { on: vi.fn(), open: vi.fn() };
      API.post.mockResolvedValue({ data: razorpayResponse });
    });

    it('creates the order, then opens the Razorpay checkout with the right options', async () => {
      installRazorpay();
      const { container } = renderCheckout();

      await startPayment(container);

      await waitFor(() => expect(rzpInstance.open).toHaveBeenCalled());
      expect(API.post).toHaveBeenCalledWith(
        '/orders',
        expect.objectContaining({ paymentMethod: 'RAZORPAY' })
      );
      expect(rzpOptions).toMatchObject({
        key: 'rzp_test_x',
        amount: 130000,
        currency: 'INR',
        order_id: 'order_rzp_1',
        name: 'Mini Commerce',
        description: 'Order o1',
        prefill: { name: 'Test User', email: 'test@example.com', contact: '9999999999' },
        theme: { color: '#2563eb' },
      });
      expect(rzpInstance.on).toHaveBeenCalledWith('payment.failed', expect.any(Function));
      expect(mocks.navigate).not.toHaveBeenCalled(); // not until the payment is verified
    });

    it('verifies the payment with the backend and redirects to the success page', async () => {
      installRazorpay();
      const { container } = renderCheckout();
      await startPayment(container);
      await waitFor(() => expect(rzpInstance.open).toHaveBeenCalled());
      API.post.mockResolvedValue({ data: {} });

      await act(async () => {
        await rzpOptions.handler({
          razorpay_order_id: 'order_rzp_1',
          razorpay_payment_id: 'pay_1',
          razorpay_signature: 'sig_1',
        });
      });

      expect(API.post).toHaveBeenLastCalledWith('/orders/verify-payment', {
        orderId: 'o1',
        razorpayOrderId: 'order_rzp_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'sig_1',
      });
      expect(mocks.navigate).toHaveBeenCalledWith('/order-success/o1');
    });

    it('shows the server message and re-enables the button when verification fails', async () => {
      installRazorpay();
      const { container } = renderCheckout();
      await startPayment(container);
      await waitFor(() => expect(rzpInstance.open).toHaveBeenCalled());
      API.post.mockRejectedValue({ response: { data: { message: 'Payment verification failed' } } });

      await act(async () => {
        await rzpOptions.handler({});
      });

      expect(screen.getByText('Payment verification failed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pay ₹1300.00' })).toBeEnabled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('shows a generic message when verification fails without a server response', async () => {
      installRazorpay();
      const { container } = renderCheckout();
      await startPayment(container);
      await waitFor(() => expect(rzpInstance.open).toHaveBeenCalled());
      API.post.mockRejectedValue(new Error('Network Error'));

      await act(async () => {
        await rzpOptions.handler({});
      });

      expect(screen.getByText('Payment verification failed')).toBeInTheDocument();
    });

    it('explains that the order is saved as pending when the payment window is closed', async () => {
      installRazorpay();
      const { container } = renderCheckout();
      await startPayment(container);
      await waitFor(() => expect(rzpInstance.open).toHaveBeenCalled());

      act(() => {
        rzpOptions.modal.ondismiss();
      });

      expect(
        screen.getByText('Payment was cancelled. Your order is saved as pending.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pay ₹1300.00' })).toBeEnabled();
    });

    it('shows the failure reason from Razorpay, or a generic one', async () => {
      installRazorpay();
      const { container } = renderCheckout();
      await startPayment(container);
      await waitFor(() => expect(rzpInstance.open).toHaveBeenCalled());
      const onFailed = rzpInstance.on.mock.calls[0][1];

      act(() => {
        onFailed({ error: { description: 'Card declined' } });
      });
      expect(screen.getByText('Card declined')).toBeInTheDocument();

      act(() => {
        onFailed({});
      });
      expect(screen.getByText('Payment failed')).toBeInTheDocument();
    });

    describe('loading the Razorpay script', () => {
      const getScript = () =>
        document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');

      it('adds the checkout script when Razorpay is not loaded yet, then opens it once loaded', async () => {
        const { container } = renderCheckout();

        await startPayment(container);

        await waitFor(() => expect(getScript()).toBeInTheDocument());
        installRazorpay(); // what the real script does when it finishes loading
        act(() => {
          getScript().onload();
        });

        await waitFor(() => expect(rzpInstance.open).toHaveBeenCalled());
      });

      it('shows an error when the script cannot be loaded', async () => {
        const { container } = renderCheckout();

        await startPayment(container);

        await waitFor(() => expect(getScript()).toBeInTheDocument());
        act(() => {
          getScript().onerror();
        });

        expect(
          await screen.findByText('Could not load Razorpay. Check your internet connection.')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pay ₹1300.00' })).toBeEnabled();
      });
    });
  });
});