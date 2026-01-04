import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NotFound from '../pages/NotFound';

describe('NotFound Component', () => {
  it('should render 404 heading', () => {
    render(
      <BrowserRouter>
        <NotFound />
      </BrowserRouter>
    );
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('should render "Page not found" message', () => {
    render(
      <BrowserRouter>
        <NotFound />
      </BrowserRouter>
    );
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('should render "Go back home" link', () => {
    render(
      <BrowserRouter>
        <NotFound />
      </BrowserRouter>
    );
    expect(screen.getByText('Go back home')).toBeInTheDocument();
  });

  it('should have link pointing to home page', () => {
    render(
      <BrowserRouter>
        <NotFound />
      </BrowserRouter>
    );
    const link = screen.getByText('Go back home').closest('a');
    expect(link).toHaveAttribute('href', '/');
  });
});
