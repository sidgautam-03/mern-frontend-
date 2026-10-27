import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, ShoppingCart } from 'lucide-react';
import API from '../api/axiosInstance';
import { useAuth } from '../Context/AuthContext';
import { useCart } from '../Context/CartContext';

// sort options backend ke ?sortBy= aur ?order= se match karte hain
const SORTS = {
  newest: {},
  price_asc: { sortBy: 'price', order: 'asc' },
  price_desc: { sortBy: 'price', order: 'desc' },
  name_asc: { sortBy: 'name', order: 'asc' },
};

const ProductListPage = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [addingId, setAddingId] = useState(null);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');

  // category list ek baar, bina filter ke
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data } = await API.get('/products');
        setCategories([...new Set(data.map((p) => p.category))]);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, []);

  // search type karte waqt har key par request na jaye
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // saare products MongoDB se, filter aur sort ke saath
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = { ...SORTS[sort] };
        if (debounced) params.keyword = debounced;
        if (category !== 'all') params.category = category;

        const { data } = await API.get('/products', { params });
        setProducts(data);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('Could not load products. Is the backend running?');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [debounced, category, sort]);

  // notice 3 second baad hat jaaye
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const handleAdd = async (product) => {
    // cart protected hai, login zaroori
    if (!user) {
      navigate('/login');
      return;
    }

    setAddingId(product._id);
    try {
      await addToCart(product._id, 1);
      setNotice(`${product.name} added to cart`);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not add to cart');
    } finally {
      setAddingId(null);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await API.delete(`/products/${id}`);
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete product');
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>

        {/* admin ke liye product creation */}
        {isAdmin && (
          <Link
            to="/admin/products/new"
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add product
          </Link>
        )}
      </div>

      {notice && (
        <p className="fixed right-4 top-4 z-50 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm shadow-lg">
          {notice}
        </p>
      )}

      {/* ---------- search, filter, sort ---------- */}
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 capitalize"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name_asc">Name: A to Z</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* ---------- products grid ---------- */}
      {loading ? (
        <p className="py-12 text-center text-gray-500">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="py-12 text-center text-gray-500">No products found.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => {
            const outOfStock = product.stock < 1;

            return (
              <div
                key={product._id}
                className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* image */}
                <Link to={`/product/${product._id}`}>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-48 w-full bg-gray-100 object-cover"
                  />
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {product.category}
                  </p>

                  {/* name */}
                  <Link
                    to={`/product/${product._id}`}
                    className="mt-1 font-semibold text-gray-900 hover:text-blue-600"
                  >
                    {product.name}
                  </Link>

                  {/* description */}
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                    {product.description}
                  </p>

                  {/* price aur stock */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">
                      ₹{Number(product.price).toFixed(2)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        outOfStock
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
                    </span>
                  </div>

                  {/* add to cart */}
                  <button
                    onClick={() => handleAdd(product)}
                    disabled={outOfStock || addingId === product._id}
                    className="mt-4 flex items-center justify-center gap-2 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShoppingCart size={16} />
                    {addingId === product._id ? 'Adding...' : 'Add to Cart'}
                  </button>

                  {/* admin: editing aur delete */}
                  {isAdmin && (
                    <div className="mt-2 flex gap-2">
                      <Link
                        to={`/admin/products/${product._id}/edit`}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-300 py-1.5 text-sm hover:bg-gray-50"
                      >
                        <Pencil size={14} />
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(product._id, product.name)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md border border-red-200 py-1.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductListPage;