import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';

function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            await register(name, email, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
                Create Account
            </h2>

            {error && (
                <p className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                    {error}
                </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                    {loading ? 'Creating account...' : 'Register'}
                </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 hover:underline">
                    Login
                </Link>
            </p>
        </div>
    );
}

export default RegisterPage;