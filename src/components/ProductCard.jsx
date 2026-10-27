import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../Context/CartContext';
import { useAuth } from '../Context/AuthContext';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  const handleAdd = async () => {
    // cart protected hai, login zaroori
    if (!user) {
      navigate('/login');
      return;
    }

    setAdding(true);
    setMessage('');
    try {
      await addToCart(product._id, 1);
      setMessage('Added to cart');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not add to cart');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/product/${product._id}`}>
        <img src={product.image} alt={product.name} className="h-48 w-full object-cover" />
      </Link>

      <div className="flex flex-1 flex-col justify-between space-y-3 p-4">
        <div>
          <Link to={`/product/${product._id}`}>
            <h3 className="line-clamp-1 font-semibold text-gray-900 hover:text-indigo-600">
              {product.name}
            </h3>
          </Link>
          <p className="text-xs capitalize text-gray-500">{product.category}</p>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">₹{product.price.toFixed(2)}</span>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              product.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
          </span>
        </div>

        <button
          onClick={handleAdd}
          disabled={product.stock === 0 || adding}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <ShoppingCart className="h-4 w-4" />
          {adding ? 'Adding...' : 'Add to Cart'}
        </button>

        {message && <p className="text-center text-xs text-gray-600">{message}</p>}
      </div>
    </div>
  );
};

export default ProductCard;