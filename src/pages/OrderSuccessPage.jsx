import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import API from '../api/axiosInstance';
import { useCart } from '../Context/CartContext';

const OrderSuccessPage = () => {
  const { orderId } = useParams();
  const { clearCart } = useCart();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const cleared = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await API.get(`/orders/${orderId}`);
        setOrder(data);

        // cart sirf tab khaali karo jab order paid ho ya direct ho.
        // Razorpay payment pending hai to user ka cart mat chhedo.
        const shouldClear = data.isPaid || data.paymentMethod === 'DIRECT';
        if (shouldClear && !cleared.current) {
          cleared.current = true;
          try {
            await clearCart();
          } catch (err) {
            // cart pehle se khaali ho sakta hai, koi dikkat nahi
            console.error('Cart clear skipped:', err.message);
          }
        }
      } catch (err) {
        console.error('Failed to fetch order:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) {
    return <p className="py-12 text-center text-gray-500">Loading order...</p>;
  }

  if (!order) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">Order not found.</p>
        <Link to="/products" className="mt-4 inline-block text-blue-600 hover:underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  const paymentLabel = order.isPaid
    ? 'Paid'
    : order.paymentMethod === 'RAZORPAY'
    ? 'Payment pending'
    : 'Direct order (no online payment)';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <CheckCircle size={56} className="mx-auto text-green-600" />
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Thank you for your order!</h1>
        <p className="mt-1 text-sm text-gray-600">
          Order ID: <span className="font-mono">{order._id}</span>
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <p>
            <span className="text-gray-500">Payment status: </span>
            <span className={`font-medium ${order.isPaid ? 'text-green-600' : 'text-amber-600'}`}>
              {paymentLabel}
            </span>
          </p>
          <p>
            <span className="text-gray-500">Order status: </span>
            <span className="font-medium capitalize">{order.status}</span>
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-semibold text-gray-900">Items</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {order.orderItems.map((item) => (
              <li key={item.product} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-10 w-10 rounded-md border border-gray-200 object-cover"
                  />
                  <span>
                    {item.name} <span className="text-gray-400">x {item.quantity}</span>
                  </span>
                </div>
                <span className="font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-lg font-bold">
            <span>Total</span>
            <span>₹{order.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-sm">
          <h2 className="mb-1 font-semibold text-gray-900">Shipping to</h2>
          <p>{order.shippingAddress.fullName}</p>
          <p>{order.shippingAddress.street}</p>
          <p>
            {order.shippingAddress.city} - {order.shippingAddress.postalCode}
          </p>
          <p>Phone: {order.shippingAddress.phone}</p>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link
          to="/products"
          className="inline-block rounded-md bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
};

export default OrderSuccessPage;