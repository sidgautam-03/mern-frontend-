import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/axiosInstance';
import { useAuth } from '../Context/AuthContext';
import { useCart } from '../Context/CartContext';

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const Field = ({ label, error, children }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

const CheckoutPage = () => {
  const { user } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: user?.name || '',
    phone: '',
    street: '',
    city: '',
    postalCode: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('DIRECT');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const items = cart.items.filter((i) => i.product);

  // stock kam pad gaya ho to order nahi jaana chahiye
  const stockProblems = items.filter((i) => i.product.stock < i.quantity);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!/^\d{10}$/.test(form.phone.trim())) e.phone = 'Enter a 10 digit phone number';
    if (!form.street.trim()) e.street = 'Street address is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!/^\d{6}$/.test(form.postalCode.trim())) e.postalCode = 'Enter a 6 digit postal code';
    return e;
  };

  const payWithRazorpay = async ({ order, razorpay }) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      throw new Error('Could not load Razorpay. Check your internet connection.');
    }

    const rzp = new window.Razorpay({
      key: razorpay.keyId,
      amount: razorpay.amount,
      currency: razorpay.currency,
      order_id: razorpay.orderId,
      name: 'Mini Commerce',
      description: `Order ${order._id}`,
      prefill: { name: form.fullName, email: user?.email, contact: form.phone },
      theme: { color: '#2563eb' },

      // payment ho gaya: backend se signature verify karwao
      handler: async (response) => {
        try {
          await API.post('/orders/verify-payment', {
            orderId: order._id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          navigate(`/order-success/${order._id}`);
        } catch (err) {
          setError(err.response?.data?.message || 'Payment verification failed');
          setSubmitting(false);
        }
      },

      modal: {
        ondismiss: () => {
          setError('Payment was cancelled. Your order is saved as pending.');
          setSubmitting(false);
        },
      },
    });

    rzp.on('payment.failed', (resp) => {
      setError(resp.error?.description || 'Payment failed');
      setSubmitting(false);
    });

    rzp.open();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (stockProblems.length > 0) {
      setError('Some items are out of stock. Please update your cart first.');
      return;
    }

    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);

    try {
      const shippingAddress = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        street: form.street.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
      };

      // backend yahan DB se stock dobara validate karta hai aur order save karta hai
      const { data } = await API.post('/orders', { shippingAddress, paymentMethod });

      // razorpay data aaya hai to online payment, warna direct order ban chuka hai
      if (data.razorpay) {
        await payWithRazorpay(data);
      } else {
        navigate(`/order-success/${data.order._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not place order');
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">Your cart is empty.</p>
        <Link to="/products" className="mt-4 inline-block text-blue-600 hover:underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- shipping, contact, payment ---------- */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2"
        >
          <h2 className="text-lg font-semibold text-gray-900">Shipping and contact details</h2>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {stockProblems.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">Stock changed for these items:</p>
              <ul className="mt-1 list-disc pl-5">
                {stockProblems.map(({ product, quantity }) => (
                  <li key={product._id}>
                    {product.name}: you have {quantity}, only {product.stock} available
                  </li>
                ))}
              </ul>
              <Link to="/cart" className="mt-2 inline-block text-blue-600 hover:underline">
                Update cart
              </Link>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" error={errors.fullName}>
              <input name="fullName" value={form.fullName} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="Phone" error={errors.phone}>
              <input
                name="phone"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={handleChange}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Street address" error={errors.street}>
            <input name="street" value={form.street} onChange={handleChange} className={inputClass} />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="City" error={errors.city}>
              <input name="city" value={form.city} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="Postal code" error={errors.postalCode}>
              <input
                name="postalCode"
                inputMode="numeric"
                maxLength={6}
                value={form.postalCode}
                onChange={handleChange}
                className={inputClass}
              />
            </Field>
          </div>

          <h2 className="pt-2 text-lg font-semibold text-gray-900">Payment</h2>

          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-300 p-3">
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === 'DIRECT'}
              onChange={() => setPaymentMethod('DIRECT')}
            />
            <span className="text-sm">Place order directly (no online payment)</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-300 p-3">
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === 'RAZORPAY'}
              onChange={() => setPaymentMethod('RAZORPAY')}
            />
            <span className="text-sm">Pay online with Razorpay</span>
          </label>

          <button
            type="submit"
            disabled={submitting || stockProblems.length > 0}
            className="w-full rounded-md bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Processing...'
              : paymentMethod === 'RAZORPAY'
              ? `Pay ₹${cart.totalAmount.toFixed(2)}`
              : 'Place order'}
          </button>
        </form>

        {/* ---------- order summary ---------- */}
        <div className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Order summary</h2>

          <ul className="space-y-3 text-sm">
            {items.map(({ product, quantity }) => (
              <li key={product._id} className="flex justify-between gap-3">
                <span className="text-gray-700">
                  {product.name} <span className="text-gray-400">x {quantity}</span>
                </span>
                <span className="font-medium">₹{(product.price * quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-between border-t border-gray-200 pt-3 text-sm text-gray-600">
            <span>Subtotal</span>
            <span>₹{cart.subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex justify-between text-lg font-bold text-gray-900">
            <span>Final amount</span>
            <span>₹{cart.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;