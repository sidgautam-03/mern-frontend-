import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import API from '../api/axiosInstance';
import { useCart } from '../Context/CartContext';
import { useAuth } from '../Context/AuthContext';

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');

  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await API.get(`/products/${id}`);
        setProduct(data);
      } catch (err) {
        console.error('Failed to fetch product:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = async () => {
    // cart protected route hai, login zaroori
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await addToCart(product._id, quantity);
      setMessage('Added to cart');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not add to cart');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading product details...</div>;
  }

  if (!product) {
    return <div className="text-center py-12 text-gray-500">Product not found.</div>;
  }

  const outOfStock = product.stock < 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        <img
          src={product.image}
          alt={product.name}
          className="w-full rounded-xl border border-gray-200 object-cover"
        />

        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500">{product.category}</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold text-gray-900">₹{product.price}</p>
          <p className="mt-4 text-gray-600">{product.description}</p>

          <p className={`mt-4 text-sm ${outOfStock ? 'text-red-600' : 'text-green-600'}`}>
            {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
          </p>

          {!outOfStock && (
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center rounded-md border border-gray-300">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:bg-gray-100"
                >
                  −
                </button>
                <span className="px-4">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="px-3 py-2 hover:bg-gray-100"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
              >
                <ShoppingCart size={18} />
                Add to cart
              </button>
            </div>
          )}

          {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        </div>
      </div>
    </div>
  );
};

export default ProductPage;