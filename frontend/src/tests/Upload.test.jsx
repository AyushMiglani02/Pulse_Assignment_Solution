import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Upload from '../pages/Upload';
import * as AuthContext from '../context/AuthContext';
import api from '../utils/api';

// Mock the API
vi.mock('../utils/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to render with mocked auth
const renderWithAuth = (component, authOverrides = {}) => {
  const defaultAuth = {
    isAuthenticated: true,
    user: { _id: '123', name: 'Test User', email: 'test@test.com', role: 'editor' },
    hasMinRole: vi.fn(role => role === 'viewer' || role === 'editor'),
    ...authOverrides,
  };

  vi.spyOn(AuthContext, 'useAuth').mockReturnValue(defaultAuth);

  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Upload Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render upload form for editor', () => {
    renderWithAuth(<Upload />);

    expect(screen.getByRole('heading', { name: /Upload Video/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
  });

  it('should show access denied for viewer', () => {
    renderWithAuth(<Upload />, {
      user: { _id: '123', name: 'Viewer', email: 'viewer@test.com', role: 'viewer' },
      hasMinRole: vi.fn(() => false),
    });

    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    expect(screen.getByText(/need to be an Editor or Admin/i)).toBeInTheDocument();
  });

  it('should display drag and drop area', () => {
    renderWithAuth(<Upload />);

    expect(screen.getByText(/Drag and drop your video here/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose File/i)).toBeInTheDocument();
  });

  it('should show file info after selection', async () => {
    renderWithAuth(<Upload />);

    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText(/Choose File/i, { selector: 'input[type="file"]' });

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    });
  });

  it('should validate required title', async () => {
    renderWithAuth(<Upload />);

    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText(/Choose File/i, { selector: 'input[type="file"]' });

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    const titleInput = screen.getByLabelText(/Title/i);
    fireEvent.change(titleInput, { target: { value: '' } });

    const submitButton = screen.getByRole('button', { name: /Upload Video/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
    });
  });

  it('should reject invalid file type', async () => {
    renderWithAuth(<Upload />);

    const file = new File(['text content'], 'document.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/Choose File/i, { selector: 'input[type="file"]' });

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
    });
  });

  it('should show character count for title and description', () => {
    renderWithAuth(<Upload />);

    const titleInput = screen.getByLabelText(/Title/i);
    const descriptionInput = screen.getByLabelText(/Description/i);

    fireEvent.change(titleInput, { target: { value: 'Test Video' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    expect(screen.getByText('10/200')).toBeInTheDocument();
    expect(screen.getByText('16/2000')).toBeInTheDocument();
  });

  it('should disable submit button when no file selected', () => {
    renderWithAuth(<Upload />);

    const submitButton = screen.getByRole('button', { name: /Upload Video/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button after file selection', async () => {
    renderWithAuth(<Upload />);

    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText(/Choose File/i, { selector: 'input[type="file"]' });

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Upload Video/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should successfully upload video', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          video: {
            _id: '123',
            title: 'Test Video',
            description: 'Test description',
            status: 'uploaded',
            fileSizeFormatted: '1.00 MB',
          },
        },
      },
    };

    api.post.mockResolvedValueOnce(mockResponse);

    renderWithAuth(<Upload />);

    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText(/Choose File/i, { selector: 'input[type="file"]' });

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/Title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Video' } });

    const submitButton = screen.getByRole('button', { name: /Upload Video/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Upload Successful!/i)).toBeInTheDocument();
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });
  });

  it('should show error message on upload failure', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: {
          error: 'Upload failed',
        },
      },
    });

    renderWithAuth(<Upload />);

    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText(/Choose File/i, { selector: 'input[type="file"]' });

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    const titleInput = screen.getByLabelText(/Title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Video' } });

    const submitButton = screen.getByRole('button', { name: /Upload Video/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });

  it('should reset form', async () => {
    renderWithAuth(<Upload />);

    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText(/Choose File/i, { selector: 'input[type="file"]' });

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    const titleInput = screen.getByLabelText(/Title/i);
    const descriptionInput = screen.getByLabelText(/Description/i);

    fireEvent.change(titleInput, { target: { value: 'Test Video' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    const resetButton = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetButton);

    expect(titleInput.value).toBe('');
    expect(descriptionInput.value).toBe('');
  });
});
