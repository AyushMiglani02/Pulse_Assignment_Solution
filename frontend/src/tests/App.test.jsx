import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

describe('App Component', () => {
  it('should render without crashing', () => {
    render(<App />);
    // Check for multiple instances since it appears in both nav and heading
    const elements = screen.getAllByText(/Video Processing Platform/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it('should render navigation bar', () => {
    render(<App />);
    const navElement = screen.getByRole('navigation');
    expect(navElement).toBeInTheDocument();
  });

  it('should render home link in navigation', () => {
    render(<App />);
    const homeLinks = screen.getAllByText(/Home/i);
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it('should render main content area', () => {
    render(<App />);
    const mainElement = screen.getByRole('main');
    expect(mainElement).toBeInTheDocument();
  });
});
