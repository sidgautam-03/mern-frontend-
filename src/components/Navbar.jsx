import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, LogOut } from 'lucide-react';
import { useAuth } from '../Context/AuthContext';
import { useCart } from '../Context/CartContext';

const linkClass = 'text-gray-700 hover:text-blue-600';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <ShoppingBag size={24} className="text-blue-600" />
          Mini Commerce
        </Link>

        <div className="flex flex-wrap items-center gap-5 text-sm font-medium">
          <Link to="/" className={linkClass}>Home</Link>
          <Link to="/products" className={linkClass}>Products</Link>

          {user?.role === 'admin' && (
            <Link to="/admin" className={linkClass}>Admin</Link>
          )}

          <Link to="/cart" className={`flex items-center gap-1 ${linkClass}`}>
            <ShoppingCart size={20} />
            Cart
            {itemCount > 0 && (
              <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-gray-700 hover:text-red-600"
            >
              <LogOut size={18} />
              Logout ({user.name})
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-blue-600 px-4 py-1.5 text-white hover:bg-blue-700"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;