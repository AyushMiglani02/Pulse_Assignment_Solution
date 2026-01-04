import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import VideoDetail from '../pages/VideoDetail';
import AuthContext from '../context/AuthContext';
import api from '../utils/api';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-video-id-123' }),
    useNavigate: () => mockNavigate,
  };
});

// Mock api
vi.mock('../utils/api');

describe('VideoDetail Component', () => {
  const mockAuthValue = {
    user: { _id: 'user-123', email: 'test@example.com', role: 'editor' },
    token: 'mock-token',
  };

  const mockVideo = {
    _id: 'test-video-id-123',
    title: 'Test Video',
    description: 'Test video description',
    status: 'ready',
    sensitivity: 'safe',
    duration: 120,
    resolution: { width: 1920, height: 1080 },
    codec: 'h264',
    format: 'mp4',
    mimeType: 'video/mp4',
    fileSize: 15728640,
    fileSizeFormatted: '15.00 MB',
    createdAt: '2026-01-07T10:00:00.000Z',
    sensitivityFlags: [],
  };

  const renderComponent = (authValue = mockAuthValue) => {
    return render(
      <AuthContext.Provider value={authValue}>
        <BrowserRouter>
          <VideoDetail />
        </BrowserRouter>
      </AuthContext.Provider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    test('should show loading spinner while fetching video', () => {
      api.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });
  });

  describe('Video Display', () => {
    test('should display video metadata when loaded', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument();
      });

      expect(screen.getByText('Test video description')).toBeInTheDocument();
      expect(screen.getByText(/READY/i)).toBeInTheDocument();
      expect(screen.getByText(/SAFE/i)).toBeInTheDocument();
    });

    test('should display video player when status is ready', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const video = screen.getByRole('video', { hidden: true });
        expect(video).toBeInTheDocument();
      });
    });

    test('should display video duration in MM:SS format', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/2:00/)).toBeInTheDocument(); // 120 seconds = 2:00
      });
    });

    test('should display resolution', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/1920.*×.*1080/)).toBeInTheDocument();
      });
    });

    test('should display codec and format', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/H264/i)).toBeInTheDocument();
        expect(screen.getByText(/MP4/i)).toBeInTheDocument();
      });
    });
  });

  describe('Video Not Ready State', () => {
    test('should show placeholder when video is processing', async () => {
      const processingVideo = {
        ...mockVideo,
        status: 'processing',
      };

      api.get.mockResolvedValue({
        data: { data: { video: processingVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Video Not Ready/i)).toBeInTheDocument();
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      // Should not render video player
      expect(screen.queryByRole('video')).not.toBeInTheDocument();
    });

    test('should show placeholder when video is uploaded', async () => {
      const uploadedVideo = {
        ...mockVideo,
        status: 'uploaded',
      };

      api.get.mockResolvedValue({
        data: { data: { video: uploadedVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Video Not Ready/i)).toBeInTheDocument();
        expect(screen.getByText(/uploaded/i)).toBeInTheDocument();
      });
    });

    test('should show processing error if present', async () => {
      const failedVideo = {
        ...mockVideo,
        status: 'failed',
        processingError: 'FFmpeg encoding failed',
      };

      api.get.mockResolvedValue({
        data: { data: { video: failedVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/FFmpeg encoding failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should display error message when video fetch fails', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Video not found' } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Error Loading Video/i)).toBeInTheDocument();
        expect(screen.getByText(/Video not found/i)).toBeInTheDocument();
      });
    });

    test('should display generic error message when no error details', async () => {
      api.get.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load video details/i)).toBeInTheDocument();
      });
    });

    test('should show back to videos button on error', async () => {
      api.get.mockRejectedValue({
        response: { data: { error: 'Not found' } },
      });

      renderComponent();

      await waitFor(() => {
        const backButton = screen.getByText(/Back to Videos/i);
        expect(backButton).toBeInTheDocument();
        expect(backButton.closest('a')).toHaveAttribute('href', '/videos');
      });
    });
  });

  describe('Sensitivity Display', () => {
    test('should display sensitivity badge with correct color for safe', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const badge = screen.getByText(/SAFE/i);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('text-green-700');
      });
    });

    test('should display sensitivity badge with correct color for flagged', async () => {
      const flaggedVideo = {
        ...mockVideo,
        sensitivity: 'flagged',
        sensitivityFlags: ['keyword-match', 'low-bitrate'],
      };

      api.get.mockResolvedValue({
        data: { data: { video: flaggedVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const badge = screen.getByText(/FLAGGED/i);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('text-red-700');
      });
    });

    test('should display sensitivity flags when present', async () => {
      const flaggedVideo = {
        ...mockVideo,
        sensitivity: 'flagged',
        sensitivityFlags: ['keyword-match', 'low-bitrate', 'duration-extreme'],
      };

      api.get.mockResolvedValue({
        data: { data: { video: flaggedVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Sensitivity Analysis/i)).toBeInTheDocument();
        expect(screen.getByText(/Keyword Match/i)).toBeInTheDocument();
        expect(screen.getByText(/Low Bitrate/i)).toBeInTheDocument();
        expect(screen.getByText(/Duration Extreme/i)).toBeInTheDocument();
      });
    });

    test('should not show sensitivity analysis card when no flags', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Sensitivity Analysis/i)).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    test('should have back to videos link', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const backLink = screen.getByText(/Back to Videos/i);
        expect(backLink.closest('a')).toHaveAttribute('href', '/videos');
      });
    });
  });

  describe('Video Player Integration', () => {
    test('should set correct video source URL', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const video = screen.getByRole('video', { hidden: true });
        const source = video.querySelector('source');
        expect(source).toHaveAttribute('src');
        expect(source.getAttribute('src')).toContain('/api/videos/test-video-id-123/stream');
      });
    });

    test('should set correct video MIME type', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const video = screen.getByRole('video', { hidden: true });
        const source = video.querySelector('source');
        expect(source).toHaveAttribute('type', 'video/mp4');
      });
    });

    test('should have controls enabled', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const video = screen.getByRole('video', { hidden: true });
        expect(video).toHaveAttribute('controls');
      });
    });

    test('should preload metadata', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const video = screen.getByRole('video', { hidden: true });
        expect(video).toHaveAttribute('preload', 'metadata');
      });
    });
  });

  describe('Status Badges', () => {
    test('should show READY badge with green color', async () => {
      api.get.mockResolvedValue({
        data: { data: { video: mockVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const badge = screen.getByText(/READY/i);
        expect(badge).toHaveClass('bg-green-100', 'text-green-800');
      });
    });

    test('should show PROCESSING badge with blue color and animation', async () => {
      const processingVideo = { ...mockVideo, status: 'processing' };
      api.get.mockResolvedValue({
        data: { data: { video: processingVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const badge = screen.getByText(/PROCESSING/i);
        expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'animate-pulse');
      });
    });

    test('should show FAILED badge with red color', async () => {
      const failedVideo = { ...mockVideo, status: 'failed' };
      api.get.mockResolvedValue({
        data: { data: { video: failedVideo } },
      });

      renderComponent();

      await waitFor(() => {
        const badge = screen.getByText(/FAILED/i);
        expect(badge).toHaveClass('bg-red-100', 'text-red-800');
      });
    });
  });
});
