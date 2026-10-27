import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import API from '../../api/axiosInstance';

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

const Field = ({ label, error, children }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

const isValidUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const ProductFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id); // id hai to edit, nahi to naya product
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  // edit mode: purana data form mein bharo
  useEffect(() => {
    if (!isEdit) return;

    const load = async () => {
      try {
        const { data } = await API.get(`/products/${id}`);
        setForm({
          name: data.name,
          price: String(data.price),
          description: data.description,
          image: data.image,
          category: data.category,
          stock: String(data.stock),
        });
      } catch (err) {
        setError('Product not found');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, isEdit]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  // form inputs ki validation
  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.category.trim()) e.category = 'Category is required';
    if (form.price === '' || Number(form.price) < 0) {
      e.price = 'Enter a valid price (0 or more)';
    }
    if (
      form.stock === '' ||
      !Number.isInteger(Number(form.stock)) ||
      Number(form.stock) < 0
    ) {
      e.stock = 'Stock must be a whole number (0 or more)';
    }
    if (!isValidUrl(form.image.trim())) e.image = 'Enter a valid image URL';
    if (form.description.trim().length < 10) {
      e.description = 'Description must be at least 10 characters';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      image: form.image.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
    };

    try {
      if (isEdit) {
        await API.put(`/products/${id}`, payload);
      } else {
        await API.post('/products', payload);
      }
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${form.name}"? This cannot be undone.`)) return;

    try {
      await API.delete(`/products/${id}`);
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete product');
    }
  };

  if (loading) {
    return <p className="py-12 text-center text-gray-500">Loading product...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Edit product' : 'Add new product'}
        </h1>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <input name="name" value={form.name} onChange={handleChange} className={inputClass} />
          </Field>

          <Field label="Category" error={errors.category}>
            <input
              name="category"
              value={form.category}
              onChange={handleChange}
              className={inputClass}
            />
          </Field>

          <Field label="Price (₹)" error={errors.price}>
            <input
              type="number"
              name="price"
              min="0"
              step="0.01"
              value={form.price}
              onChange={handleChange}
              className={inputClass}
            />
          </Field>

          <Field label="Stock" error={errors.stock}>
            <input
              type="number"
              name="stock"
              min="0"
              step="1"
              value={form.stock}
              onChange={handleChange}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Image URL" error={errors.image}>
          <input name="image" value={form.image} onChange={handleChange} className={inputClass} />
        </Field>

        {form.image && isValidUrl(form.image.trim()) && (
          <img
            src={form.image}
            alt="Preview"
            className="h-32 w-32 rounded-md border border-gray-200 object-cover"
          />
        )}

        <Field label="Description" error={errors.description}>
          <textarea
            name="description"
            rows="4"
            value={form.description}
            onChange={handleChange}
            className={inputClass}
          />
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-md bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? 'Saving...' : isEdit ? 'Update product' : 'Create product'}
          </button>

          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md border border-red-200 px-5 py-2.5 font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ProductFormPage;