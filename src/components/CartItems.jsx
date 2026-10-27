import { Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '../Context/CartContext';

const CartItem = ({ item }) => {
  const { updateQuantity, removeFromCart } = useCart();
  const { product, quantity } = item;

  // product delete ho chuka ho to populate null deta hai
  if (!product) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <img src={product.image} alt={product.name} className="h-16 w-16 rounded-lg object-cover" />

      <div className="flex-1">
        <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">{product.name}</h3>
        <p className="text-xs text-gray-500">₹{product.price.toFixed(2)} each</p>
      </div>

      <div className="flex items-center space-x-2 rounded-lg border border-gray-300 p-1">
        <button
          onClick={() => updateQuantity(product._id, quantity - 1)}
          disabled={quantity <= 1}
          className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <span className="px-2 text-xs font-bold">{quantity}</span>
        <button
          onClick={() => updateQuantity(product._id, quantity + 1)}
          disabled={quantity >= product.stock}
          className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5 text-gray-600" />
        </button>
      </div>

      <div className="text-right">
        <p className="text-sm font-bold text-gray-900">₹{(product.price * quantity).toFixed(2)}</p>
        <button
          onClick={() => removeFromCart(product._id)}
          className="mt-1 text-red-500 hover:text-red-700"
          title="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default CartItem;