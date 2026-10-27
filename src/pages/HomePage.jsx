import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import API from '../api/axiosInstance';
import ProductCard from '../components/ProductCard';

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await API.get('/products');
        setProducts(data);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('Could not load products. Is the backend running?');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // categories products se apne aap ban jaati hain
  const categories = useMemo(
    () => ['all', ...new Set(products.map((p) => p.category))],
    [products]
  );

  // naam se search + category filter
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) &&
        (category === 'all' || p.category === category)
    );
  }, [products, search, category]);

  // pehle 4 in-stock products
  const featured = useMemo(
    () => products.filter((p) => p.stock > 0).slice(0, 4),
    [products]
  );

  const isFiltering = search.trim() !== '' || category !== 'all';

  return (
    <div>
      {/* ---------- Hero banner ---------- */}
      <section className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-14 text-white">
        <h1 className="text-3xl font-bold md:text-5xl">Shop smart, shop fast</h1>
        <p className="mt-3 max-w-xl text-blue-100">
          Fresh arrivals and live stock updates. Find what you need and add it to your cart in a click.
        </p>
        <Link
          to="/products"
          className="mt-6 inline-block rounded-md bg-white px-6 py-2.5 font-semibold text-blue-700 hover:bg-blue-50"
        >
          Shop now
        </Link>
      </section>

      {error && (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* ---------- Featured products (search ya filter chalu hone par chhup jaate hain) ---------- */}
      {!loading && !isFiltering && featured.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Featured products</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Search + category filters + product cards ---------- */}
      <section className="mt-12">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">All products</h2>

        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name..."
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full border px-4 py-1.5 text-sm capitalize ${
                category === cat
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-12 text-center text-gray-500">Loading products...</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-gray-500">No products found.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;