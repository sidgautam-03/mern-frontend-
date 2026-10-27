import { createContext, useContext, useEffect, useState } from 'react';
import API from '../api/axiosInstance';
import { useAuth } from './AuthContext';

export const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: 0, totalAmount: 0 });

  // login hone par cart load karo, logout par khaali
  useEffect(() => {
    const loadCart = async () => {
      if (!user) {
        setCart({ items: [], subtotal: 0, totalAmount: 0 });
        return;
      }
      try {
        const { data } = await API.get('/cart');
        setCart(data);
      } catch (err) {
        console.error('Failed to load cart:', err);
      }
    };
    loadCart();
  }, [user]);

  const addToCart = async (productId, quantity = 1) => {
    const { data } = await API.post('/cart', { productId, quantity });
    setCart(data);
  };

  const updateQuantity = async (productId, quantity) => {
    const { data } = await API.put(`/cart/${productId}`, { quantity });
    setCart(data);
  };

  const removeFromCart = async (productId) => {
    const { data } = await API.delete(`/cart/${productId}`);
    setCart(data);
  };

  const clearCart = async () => {
    const { data } = await API.delete('/cart');
    setCart(data);
  };

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, itemCount, addToCart, updateQuantity, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);