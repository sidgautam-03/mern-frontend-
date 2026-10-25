import { useState, useEffect } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import API from '../../services/api';

const emptyForm = {
  name: '',
  price: '',
  description: '',
  image: '',
  category: '',
  stock: '',
};

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';

const AdminDashboard = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/products');
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Could not load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await API.post('/products', {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
      });

      setSuccess('Product created');
      setFormData(emptyForm);
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

    setError('');
    setSuccess('');

    try {
      await API.delete(`/products/${id}`);
      setProducts((prev) => prev.filter((p) => p._id !== id));
      setSuccess('Product deleted');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete product');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
        <Package size={26} />
        Admin Dashboard
      </h1>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </p>
      )}

      {/* ---------- Create product form ---------- */}
      <form
        onSubmit={handleCreateProduct}
        className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Add new product</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
            <input
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Price (₹)</label>
            <input
              type="number"
              name="price"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Stock</label>
            <input
              type="number"
              name="stock"
              min="0"
              step="1"
              value={formData.stock}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Image URL</label>
            <input
              type="url"
              name="image"
              value={formData.image}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus size={18} />
          {submitting ? 'Creating...' : 'Create product'}
        </button>
      </form>

      {/* ---------- Inventory table ---------- */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <h2 className="border-b border-gray-200 px-6 py-4 text-lg font-semibold text-gray-900">
          Inventory ({products.length})
        </h2>

        {loading ? (
          <p className="px-6 py-8 text-center text-gray-500">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="px-6 py-8 text-center text-gray-500">No products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Price</th>
                  <th className="px-6 py-3 font-medium">Stock</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id} className="border-t border-gray-100">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-10 w-10 rounded-md border border-gray-200 object-cover"
                        />
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 capitalize text-gray-600">{product.category}</td>
                    <td className="px-6 py-3 text-gray-900">₹{product.price}</td>
                    <td
                      className={`px-6 py-3 font-medium ${
                        product.stock === 0
                          ? 'text-red-600'
                          : product.stock <= 5
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}
                    >
                      {product.stock}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDelete(product._id, product.name)}
                        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;