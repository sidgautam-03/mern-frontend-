import { useContext } from 'react';
import { Trash2, Plus, Minus } from 'lucide-react';
import { CartContext } from '../context/CartContext';

const CartItem = ({ item }) => {
  const { updateQuantity, removeFromCart } = useContext(CartContext);
  const { productId, quantity } = item;

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
      <img
        src={productId.image}
        alt={productId.name}
        className="w-16 h-16 object-cover rounded-lg"
      />
      
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{productId.name}</h3>
        <p className="text-xs text-gray-500">${productId.price.toFixed(2)} each</p>
      </div>

      <div className="flex items-center space-x-2 border border-gray-300 rounded-lg p-1">
        <button
          onClick={() => updateQuantity(productId._id, quantity - 1)}
          disabled={quantity <= 1}
          className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
        >
          <Minus className="w-3.5 h-3.5 text-gray-600" />
        </button>
        <span className="text-xs font-bold px-2">{quantity}</span>
        <button
          onClick={() => updateQuantity(productId._id, quantity + 1)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-gray-600" />
        </button>
      </div>

      <div className="text-right">
        <p className="font-bold text-sm text-gray-900">
          ${(productId.price * quantity).toFixed(2)}
        </p>
        <button
          onClick={() => removeFromCart(productId._id)}
          className="text-red-500 hover:text-red-700 mt-1 transition-colors"
          title="Remove item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default CartItem;