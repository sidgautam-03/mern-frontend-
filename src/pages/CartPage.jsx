import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { useCart } from '../Context/CartContext';

const CartPage = () => {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  // delete ho chuke products (populate null) chhod do
  const items = cart.items.filter((item) => item.product);

  // har action ke liye common wrapper: busy state aur error message
  const run = async (id, action) => {
    setError('');
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShoppingCart size={48} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-xl font-semibold text-gray-800">Your cart is empty</h2>
        <Link
          to="/products"
          className="mt-6 inline-block rounded-md bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  // koi item stock se zyada ho to checkout rokna
  const hasStockProblem = items.some((i) => i.product.stock < i.quantity);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
        <button
          onClick={() => run('all', clearCart)}
          disabled={busyId === 'all'}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          Clear cart
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- items ---------- */}
        <div className="space-y-4 lg:col-span-2">
          {items.map(({ product, quantity }) => {
            const busy = busyId === product._id;

            return (
              <div
                key={product._id}
                className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-24 w-24 rounded-md border border-gray-200 object-cover"
                />

                <div className="flex flex-1 flex-col">
                  <Link
                    to={`/product/${product._id}`}
                    className="font-semibold text-gray-900 hover:text-blue-600"
                  >
                    {product.name}
                  </Link>
                  <p className="text-sm text-gray-500">₹{product.price} each</p>

                  {product.stock < quantity && (
                    <p className="text-xs text-red-600">
                      Only {product.stock} left in stock, please reduce quantity
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-md border border-gray-300">
                      <button
                        onClick={() =>
                          run(product._id, () => updateQuantity(product._id, quantity - 1))
                        }
                        disabled={busy || quantity <= 1}
                        className="px-3 py-1.5 hover:bg-gray-100 disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="min-w-8 text-center text-sm">{quantity}</span>
                      <button
                        onClick={() =>
                          run(product._id, () => updateQuantity(product._id, quantity + 1))
                        }
                        disabled={busy || quantity >= product.stock}
                        className="px-3 py-1.5 hover:bg-gray-100 disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <p className="font-semibold text-gray-900">
                      ₹{(product.price * quantity).toFixed(2)}
                    </p>

                    <button
                      onClick={() => run(product._id, () => removeFromCart(product._id))}
                      disabled={busy}
                      className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label="Remove item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- summary ---------- */}
        <div className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Order summary</h2>

          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>₹{cart.subtotal.toFixed(2)}</span>
          </div>

          <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-lg font-bold text-gray-900">
            <span>Total</span>
            <span>₹{cart.totalAmount.toFixed(2)}</span>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            disabled={hasStockProblem}
            className="mt-5 w-full rounded-md bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Proceed to checkout
          </button>

          {hasStockProblem && (
            <p className="mt-2 text-center text-xs text-red-600">
              Reduce quantities to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartPage;