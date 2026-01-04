import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socketService from '../services/socket';

export default function Videos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sensitivityFilter, setSensitivityFilter] = useState('all');
  const [processingProgress, setProcessingProgress] = useState({}); // Track progress by videoId

  useEffect(() => {
    fetchVideos();
  }, []);

  // Subscribe to real-time socket events
  useEffect(() => {
    if (!socketService.isConnected()) return;

    // Handle processing progress updates
    socketService.onProcessingProgress((videoId, percent) => {
      setProcessingProgress(prev => ({
        ...prev,
        [videoId]: percent,
      }));
    });

    // Handle status changes
    socketService.onProcessingStatus((videoId, status, sensitivity, sensitivityFlags) => {
      setVideos(prevVideos =>
        prevVideos.map(video =>
          video._id === videoId
            ? { ...video, status, sensitivity, sensitivityFlags }
            : video,
        ),
      );

      // Clear progress when complete
      if (status === 'ready' || status === 'failed') {
        setProcessingProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[videoId];
          return newProgress;
        });
      }
    });

    // Handle processing errors
    socketService.onProcessingError((videoId, error) => {
      console.error(`Processing error for video ${videoId}:`, error);
      // Optionally show toast notification
    });

    // Cleanup listeners on unmount
    return () => {
      socketService.off('processing:progress');
      socketService.off('processing:status');
      socketService.off('processing:error');
    };
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/videos');
      setVideos(response.data.data.videos);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError(err.response?.data?.error || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const deleteVideo = async videoId => {
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      await api.delete(`/videos/${videoId}`);
      setVideos(videos.filter(v => v._id !== videoId));
    } catch (err) {
      console.error('Error deleting video:', err);
      alert(err.response?.data?.error || 'Failed to delete video');
    }
  };

  const getStatusBadge = status => {
    const colors = {
      uploaded: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800 animate-pulse',
      ready: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const getSensitivityBadge = sensitivity => {
    if (!sensitivity) return null;
    
    const colors = {
      safe: 'bg-green-50 text-green-700 border-green-200',
      unknown: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      flagged: 'bg-red-50 text-red-700 border-red-200',
    };
    
    const icons = {
      safe: '✓',
      unknown: '?',
      flagged: '⚠',
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${colors[sensitivity] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
        {icons[sensitivity]} {sensitivity}
      </span>
    );
  };

  const formatDuration = seconds => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredVideos = videos.filter(video => {
    if (statusFilter !== 'all' && video.status !== statusFilter) return false;
    if (sensitivityFilter !== 'all' && video.sensitivity !== sensitivityFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Videos</h1>
        <Link
          to="/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Upload Video
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="uploaded">Uploaded</option>
              <option value="processing">Processing</option>
              <option value="ready">Ready</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label htmlFor="sensitivity-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Sensitivity
            </label>
            <select
              id="sensitivity-filter"
              value={sensitivityFilter}
              onChange={e => setSensitivityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="safe">Safe</option>
              <option value="unknown">Unknown</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('all');
                setSensitivityFilter('all');
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredVideos.length} of {videos.length} videos
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {filteredVideos.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {videos.length === 0 ? 'No Videos Yet' : 'No Matching Videos'}
          </h3>
          <p className="text-gray-600 mb-6">
            {videos.length === 0 
              ? 'Upload your first video to get started!' 
              : 'Try adjusting your filters to see more results.'}
          </p>
          {videos.length === 0 && (
            <Link
              to="/upload"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Video
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map(video => (
            <div key={video._id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Thumbnail - clickable */}
              <Link to={`/videos/${video._id}`} className="block">
                <div className="bg-gray-200 aspect-video flex items-center justify-center hover:bg-gray-300 transition-colors cursor-pointer">
                  <svg
                    className="h-16 w-16 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </Link>

              {/* Video Info */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
                    {video.title}
                  </h3>
                  <div className="flex flex-col gap-1 items-end">
                    {getStatusBadge(video.status)}
                    {video.sensitivity && getSensitivityBadge(video.sensitivity)}
                  </div>
                </div>

                {video.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{video.description}</p>
                )}

                {/* Real-time processing progress */}
                {video.status === 'processing' && processingProgress[video._id] !== undefined && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Processing</span>
                      <span>{processingProgress[video._id]}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${processingProgress[video._id]}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 space-y-1 mb-3">
                  <p>Size: {video.fileSizeFormatted}</p>
                  {video.duration && <p>Duration: {formatDuration(video.duration)}</p>}
                  {video.resolution && (
                    <p>Resolution: {video.resolution.width}×{video.resolution.height}</p>
                  )}
                  {video.codec && <p>Codec: {video.codec}</p>}
                  <p>Uploaded: {new Date(video.createdAt).toLocaleDateString()}</p>
                </div>

                {video.processingError && (
                  <div className="mb-3 p-2 bg-red-50 rounded text-xs text-red-600">
                    Error: {video.processingError}
                  </div>
                )}

                {video.sensitivityFlags && video.sensitivityFlags.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Sensitivity Flags:</p>
                    <div className="flex flex-wrap gap-1">
                      {video.sensitivityFlags.map((flag, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {video.status === 'ready' && (
                    <Link
                      to={`/videos/${video._id}`}
                      className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white text-center rounded hover:bg-blue-700 transition-colors"
                    >
                      Watch
                    </Link>
                  )}
                  <button
                    onClick={() => deleteVideo(video._id)}
                    className={`${video.status === 'ready' ? 'flex-1' : 'w-full'} px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
