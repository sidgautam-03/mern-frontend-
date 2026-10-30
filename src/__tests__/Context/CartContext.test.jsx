import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CartProvider, useCart } from '../../Context/CartContext.jsx';
import API from '../../api/axiosInstance.js';

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('../../Context/AuthContext.jsx', () => ({ useAuth: mocks.useAuth }));

vi.mock('../../api/axiosInstance.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// the same user object every render: the provider re-loads the cart whenever `user` changes
const user = { _id: 'u1', name: 'Test User' };

const emptyCart = { items: [], subtotal: 0, totalAmount: 0 };
const cartData = {
  _id: 'c1',
  items: [
    { product: { _id: 'p1', price: 500 }, quantity: 2 },
    { product: { _id: 'p2', price: 250 }, quantity: 3 },
  ],
  subtotal: 1750,
  totalAmount: 1750,
};

const renderCart = () => renderHook(() => useCart(), { wrapper: CartProvider });

// logged-in user whose cart has already been loaded from the API
const renderLoadedCart = async () => {
  API.get.mockResolvedValue({ data: cartData });
  const hook = renderCart();
  await waitFor(() => expect(hook.result.current.cart).toEqual(cartData));
  return hook;
};

describe('CartContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loading the cart', () => {
    it('starts empty and makes no request when nobody is logged in', async () => {
      mocks.useAuth.mockReturnValue({ user: null });

      const { result } = renderCart();

      expect(result.current.cart).toEqual(emptyCart);
      expect(result.current.itemCount).toBe(0);
      expect(API.get).not.toHaveBeenCalled();
    });

    it('loads the cart from GET /cart when a user is logged in', async () => {
      const { result } = await renderLoadedCart();

      expect(API.get).toHaveBeenCalledWith('/cart');
      expect(result.current.cart).toEqual(cartData);
    });

    it('computes itemCount as the sum of all quantities', async () => {
      const { result } = await renderLoadedCart();

      expect(result.current.itemCount).toBe(5); // 2 + 3
    });

    it('keeps the empty cart and logs an error when loading fails', async () => {
      API.get.mockRejectedValue(new Error('Network Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderCart();

      await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
      expect(result.current.cart).toEqual(emptyCart);
    });

    it('empties the cart when the user logs out', async () => {
      const { result, rerender } = await renderLoadedCart();

      mocks.useAuth.mockReturnValue({ user: null });
      rerender();

      await waitFor(() => expect(result.current.cart).toEqual(emptyCart));
      expect(result.current.itemCount).toBe(0);
    });
  });

  describe('addToCart', () => {
    it('posts productId and quantity, then stores the returned cart', async () => {
      const { result } = await renderLoadedCart();
      const updated = { ...cartData, items: [{ product: { _id: 'p3', price: 100 }, quantity: 4 }] };
      API.post.mockResolvedValue({ data: updated });

      await act(async () => {
        await result.current.addToCart('p3', 4);
      });

      expect(API.post).toHaveBeenCalledWith('/cart', { productId: 'p3', quantity: 4 });
      expect(result.current.cart).toEqual(updated);
      expect(result.current.itemCount).toBe(4);
    });

    it('defaults the quantity to 1', async () => {
      const { result } = await renderLoadedCart();
      API.post.mockResolvedValue({ data: cartData });

      await act(async () => {
        await result.current.addToCart('p3');
      });

      expect(API.post).toHaveBeenCalledWith('/cart', { productId: 'p3', quantity: 1 });
    });

    it('rejects with the error and leaves the cart unchanged when the request fails', async () => {
      const { result } = await renderLoadedCart();
      API.post.mockRejectedValue(new Error('Only 2 items in stock.'));

      await act(async () => {
        await expect(result.current.addToCart('p1', 99)).rejects.toThrow('Only 2 items in stock.');
      });

      expect(result.current.cart).toEqual(cartData);
    });
  });

  describe('updateQuantity', () => {
    it('puts the new quantity and stores the returned cart', async () => {
      const { result } = await renderLoadedCart();
      const updated = { ...cartData, items: [{ product: { _id: 'p1', price: 500 }, quantity: 7 }] };
      API.put.mockResolvedValue({ data: updated });

      await act(async () => {
        await result.current.updateQuantity('p1', 7);
      });

      expect(API.put).toHaveBeenCalledWith('/cart/p1', { quantity: 7 });
      expect(result.current.cart).toEqual(updated);
      expect(result.current.itemCount).toBe(7);
    });
  });

  describe('removeFromCart', () => {
    it('deletes the item and stores the returned cart', async () => {
      const { result } = await renderLoadedCart();
      const updated = { ...cartData, items: [cartData.items[1]] };
      API.delete.mockResolvedValue({ data: updated });

      await act(async () => {
        await result.current.removeFromCart('p1');
      });

      expect(API.delete).toHaveBeenCalledWith('/cart/p1');
      expect(result.current.cart).toEqual(updated);
      expect(result.current.itemCount).toBe(3);
    });
  });

  describe('clearCart', () => {
    it('deletes the whole cart and stores the returned empty cart', async () => {
      const { result } = await renderLoadedCart();
      API.delete.mockResolvedValue({ data: { _id: 'c1', ...emptyCart } });

      await act(async () => {
        await result.current.clearCart();
      });

      expect(API.delete).toHaveBeenCalledWith('/cart');
      expect(result.current.cart.items).toEqual([]);
      expect(result.current.itemCount).toBe(0);
    });
  });

  describe('useCart', () => {
    it('returns null when used outside a CartProvider', () => {
      const { result } = renderHook(() => useCart());

      expect(result.current).toBeNull();
    });
  });
});