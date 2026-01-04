import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import AssignVideo from '../components/AssignVideo';

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const videoRef = useRef(null);
  
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackError, setPlaybackError] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchVideoDetails();
  }, [id]);

  useEffect(() => {
    // Log video stream URL for debugging
    if (video && video.status === 'ready') {
      const streamUrl = getStreamUrl();
      console.log('Video stream URL:', streamUrl);
      console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
    }
  }, [video, token]);

  const fetchVideoDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/videos/${id}`);
      setVideo(response.data.data.video);
    } catch (err) {
      console.error('Error fetching video details:', err);
      setError(err.response?.data?.error || 'Failed to load video details');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoError = e => {
    console.error('Video playback error:', e);
    const streamUrl = getStreamUrl();
    console.error('Attempted video URL:', streamUrl);
    
    const videoElement = videoRef.current;
    
    if (videoElement && videoElement.error) {
      const { code, message } = videoElement.error;
      let errorMessage = 'Failed to play video';
      
      switch (code) {
        case 1: // MEDIA_ERR_ABORTED
          errorMessage = 'Video playback aborted';
          break;
        case 2: // MEDIA_ERR_NETWORK
          errorMessage = 'Network error while loading video';
          break;
        case 3: // MEDIA_ERR_DECODE
          errorMessage = 'Video decode error';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorMessage = 'Video format not supported';
          break;
        default:
          errorMessage = message || 'Unknown playback error';
      }
      
      setPlaybackError(errorMessage);
    }
  };

  const getStreamUrl = () => {
    // Use VITE_API_URL if available, otherwise fallback to localhost
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const streamUrl = `${apiBaseUrl}/api/videos/${id}/stream`;
    return token ? `${streamUrl}?token=${token}` : streamUrl;
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
      <span className={`px-3 py-1 text-sm font-medium rounded-lg border ${colors[sensitivity] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
        {icons[sensitivity]} {sensitivity.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = status => {
    const colors = {
      uploaded: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800 animate-pulse',
      ready: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-lg ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const formatDuration = seconds => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-red-900 mb-2">Error Loading Video</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <Link
            to="/videos"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Videos
          </Link>
        </div>
      </div>
    );
  }

  if (!video) {
    return null;
  }

  const canPlay = video.status === 'ready';

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/videos"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Videos
        </Link>
        
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{video.title}</h1>
            {video.description && (
              <p className="text-lg text-gray-600">{video.description}</p>
            )}
          </div>
          
          {/* Share Button for Editors and Admins */}
          {(user?.role === 'editor' || user?.role === 'admin') && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="ml-4 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Video
            </button>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <AssignVideo
          videoId={id}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => {
            // Optionally refresh video details after assignment
            fetchVideoDetails();
          }}
        />
      )}

      {/* Video Player */}
      <div className="bg-black rounded-lg overflow-hidden mb-6 shadow-lg">
        {canPlay ? (
          <div className="relative" style={{ paddingTop: '56.25%' }}>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full"
              controls
              onError={handleVideoError}
              preload="metadata"
            >
              <source
                src={getStreamUrl()}
                type={video.mimeType || 'video/mp4'}
              />
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center bg-gray-900">
            <div className="text-center text-white p-8">
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
              <h3 className="text-xl font-semibold mb-2">Video Not Ready</h3>
              <p className="text-gray-400 mb-4">
                This video is currently {video.status}. Please check back later.
              </p>
              {video.processingError && (
                <div className="mt-4 p-3 bg-red-900 bg-opacity-50 rounded">
                  <p className="text-sm text-red-200">{video.processingError}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Playback Error */}
      {playbackError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-red-400 mt-0.5 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">Playback Error</h3>
              <p className="text-sm text-red-700 mt-1">{playbackError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Video Information */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Details Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Video Details</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Status</span>
              {getStatusBadge(video.status)}
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Sensitivity</span>
              {getSensitivityBadge(video.sensitivity)}
            </div>
            
            {video.duration && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Duration</span>
                <span className="text-sm text-gray-900">{formatDuration(video.duration)}</span>
              </div>
            )}
            
            {video.resolution && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Resolution</span>
                <span className="text-sm text-gray-900">
                  {video.resolution.width} × {video.resolution.height}
                </span>
              </div>
            )}
            
            {video.codec && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Codec</span>
                <span className="text-sm text-gray-900 uppercase">{video.codec}</span>
              </div>
            )}
            
            {video.format && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Format</span>
                <span className="text-sm text-gray-900 uppercase">{video.format}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">File Size</span>
              <span className="text-sm text-gray-900">{video.fileSizeFormatted}</span>
            </div>
            
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-600">Uploaded</span>
              <span className="text-sm text-gray-900">{formatDate(video.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Sensitivity Analysis Card */}
        {video.sensitivityFlags && video.sensitivityFlags.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Sensitivity Analysis</h2>
            
            <p className="text-sm text-gray-600 mb-4">
              This video has been flagged with the following concerns:
            </p>
            
            <div className="space-y-2">
              {video.sensitivityFlags.map((flag, idx) => (
                <div
                  key={idx}
                  className="flex items-start p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                >
                  <svg
                    className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="text-sm text-yellow-900 font-medium">
                    {flag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
