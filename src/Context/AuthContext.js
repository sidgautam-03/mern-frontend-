import { createContext, useContext, useEffect, useState } from 'react';
import API from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // page reload par token se user wapas load karo
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');

      if (token) {
        try {
          const { data } = await API.get('/auth/profile');
          setUser(data);
        } catch (error) {
          console.error('Session expired or invalid:', error);
          localStorage.removeItem('token');
          setUser(null);
        }
      }

      setLoading(false);
    };

    fetchProfile();
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await API.post('/auth/register', { name, email, password });
    localStorage.setItem('token', data.token);
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// chhota helper: components mein useContext(AuthContext) ki jagah useAuth()
export const useAuth = () => useContext(AuthContext);