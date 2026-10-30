import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../../components/Footer.jsx';

describe('Footer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a footer element', () => {
    const { container } = render(<Footer />);

    expect(container.querySelector('footer')).toBeInTheDocument();
  });

  it('shows the copyright text with the brand name', () => {
    render(<Footer />);

    expect(screen.getByText(/MERNShop\. All rights reserved\./)).toBeInTheDocument();
    expect(screen.getByText(/©/)).toBeInTheDocument();
  });

  it('shows the current year', () => {
    render(<Footer />);

    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
  });

  it('updates the year from the system date (not hardcoded)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-15T10:00:00Z'));

    render(<Footer />);

    expect(screen.getByText(/2030 MERNShop/)).toBeInTheDocument();
  });
});