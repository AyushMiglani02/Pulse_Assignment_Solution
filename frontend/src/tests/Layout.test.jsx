import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Layout from '../components/Layout';

const renderWithAuth = (ui) => {
  return render(
    <BrowserRouter>
      <AuthProvider>{ui}</AuthProvider>
    </BrowserRouter>
  );
};

describe('Layout Component', () => {
  it('should render children content', () => {
    renderWithAuth(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render navigation bar with app title', () => {
    renderWithAuth(
      <Layout>
        <div>Content</div>
      </Layout>
    );
    expect(screen.getByText('Video Processing Platform')).toBeInTheDocument();
  });

  it('should render home link', () => {
    renderWithAuth(
      <Layout>
        <div>Content</div>
      </Layout>
    );
    const homeLinks = screen.getAllByText('Home');
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it('should have correct navigation structure', () => {
    renderWithAuth(
      <Layout>
        <div>Content</div>
      </Layout>
    );
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('should apply correct CSS classes for layout', () => {
    const { container } = renderWithAuth(
      <Layout>
        <div>Content</div>
      </Layout>
    );
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('min-h-screen');
  });
});
