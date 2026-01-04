import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socketService from '../services/socket';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
];

export default function Upload() {
  const { user, hasMinRole } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null); // Track processing status
  const [processingProgress, setProcessingProgress] = useState(0); // Track processing progress
  const [uploadedVideoId, setUploadedVideoId] = useState(null); // Store uploaded video ID

  // Subscribe to real-time processing updates
  useEffect(() => {
    if (!socketService.isConnected() || !uploadedVideoId) return;

    // Handle processing progress
    socketService.onProcessingProgress((videoId, percent) => {
      if (videoId === uploadedVideoId) {
        setProcessingProgress(percent);
      }
    });

    // Handle status changes
    socketService.onProcessingStatus((videoId, status, sensitivity) => {
      if (videoId === uploadedVideoId) {
        setProcessingStatus(status);
        if (status === 'ready') {
          // Processing complete, show success for 2 seconds then navigate
          setTimeout(() => {
            navigate('/videos');
          }, 2000);
        }
      }
    });

    // Handle processing errors
    socketService.onProcessingError((videoId, error) => {
      if (videoId === uploadedVideoId) {
        setProcessingStatus('failed');
        setErrors({ processing: error });
      }
    });

    // Cleanup listeners on unmount
    return () => {
      socketService.off('processing:progress');
      socketService.off('processing:status');
      socketService.off('processing:error');
    };
  }, [uploadedVideoId, navigate]);

  // Check if user has permission to upload
  if (!hasMinRole('editor')) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-700">
            You need to be an Editor or Admin to upload videos.
          </p>
        </div>
      </div>
    );
  }

  const validateFile = file => {
    const newErrors = {};

    if (!file) {
      newErrors.file = 'Please select a video file';
      return newErrors;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      newErrors.file = `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`;
      return newErrors;
    }

    if (file.size > MAX_FILE_SIZE) {
      newErrors.file = `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
      return newErrors;
    }

    return newErrors;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.length > 200) {
      newErrors.title = 'Title cannot exceed 200 characters';
    }

    if (description.length > 2000) {
      newErrors.description = 'Description cannot exceed 2000 characters';
    }

    const fileErrors = validateFile(file);
    return { ...newErrors, ...fileErrors };
  };

  const handleFileChange = e => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const fileErrors = validateFile(selectedFile);
      if (Object.keys(fileErrors).length > 0) {
        setErrors(fileErrors);
        setFile(null);
      } else {
        setFile(selectedFile);
        setErrors({});
        // Auto-fill title if empty
        if (!title) {
          setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
        }
      }
    }
  };

  const handleDrag = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    e => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const droppedFile = e.dataTransfer.files[0];
        const fileErrors = validateFile(droppedFile);
        if (Object.keys(fileErrors).length > 0) {
          setErrors(fileErrors);
          setFile(null);
        } else {
          setFile(droppedFile);
          setErrors({});
          // Auto-fill title if empty
          if (!title) {
            setTitle(droppedFile.name.replace(/\.[^/.]+$/, ''));
          }
        }
      }
    },
    [title],
  );

  const handleSubmit = async e => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setErrors({});

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title.trim());
    if (description.trim()) {
      formData.append('description', description.trim());
    }

    try {
      const response = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: progressEvent => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      const uploadedVideo = response.data.data.video;
      setUploadSuccess(uploadedVideo);
      setUploadedVideoId(uploadedVideo._id); // Store video ID for real-time updates
      setProcessingStatus('processing');
      setProcessingProgress(0);
      
      // Reset form fields but keep upload success state
      setFile(null);
      setTitle('');
      setDescription('');
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors({
        submit: error.response?.data?.error || 'Failed to upload video. Please try again.',
      });
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setErrors({});
    setUploadProgress(0);
    setUploadSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Upload Video</h1>

      {uploadSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-green-800 mb-2">Upload Successful!</h2>
          <div className="text-green-700 space-y-2">
            <p>
              <strong>Title:</strong> {uploadSuccess.title}
            </p>
            {uploadSuccess.description && (
              <p>
                <strong>Description:</strong> {uploadSuccess.description}
              </p>
            )}
            <p>
              <strong>File Size:</strong> {uploadSuccess.fileSizeFormatted}
            </p>
            <p>
              <strong>Status:</strong>{' '}
              <span className={`px-2 py-1 rounded text-sm ${
                processingStatus === 'ready' 
                  ? 'bg-green-100 text-green-800' 
                  : processingStatus === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {processingStatus || uploadSuccess.status}
              </span>
            </p>
          </div>

          {/* Real-time processing progress */}
          {processingStatus === 'processing' && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-green-700 mb-2">
                <span>Processing video...</span>
                <span>{processingProgress}%</span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-green-600 mt-2">
                Your video is being processed. You'll be automatically redirected when it's ready.
              </p>
            </div>
          )}

          {processingStatus === 'ready' && (
            <div className="mt-4">
              <p className="text-sm text-green-700 font-medium">
                ✓ Processing complete! Redirecting to your videos...
              </p>
            </div>
          )}

          {processingStatus === 'failed' && (
            <div className="mt-4">
              <p className="text-sm text-red-700 font-medium">
                ✗ Processing failed. Please try again or contact support.
              </p>
            </div>
          )}

          <div className="mt-4 space-x-4">
            <button
              onClick={() => {
                setUploadSuccess(null);
                setProcessingStatus(null);
                setProcessingProgress(0);
                setUploadedVideoId(null);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              disabled={processingStatus === 'processing'}
            >
              Upload Another
            </button>
            <button
              onClick={() => navigate('/videos')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              View My Videos
            </button>
          </div>
        </div>
      )}

      {!uploadSuccess && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${errors.file ? 'border-red-500 bg-red-50' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="video-file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />

            {!file ? (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="mt-4 text-lg text-gray-700">
                  Drag and drop your video here, or
                </p>
                <label
                  htmlFor="video-file"
                  className="mt-2 inline-block cursor-pointer px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Choose File
                </label>
                <p className="mt-4 text-sm text-gray-500">
                  Supported formats: MP4, MOV, AVI, MKV, WebM
                </p>
                <p className="text-sm text-gray-500">Maximum size: 100MB</p>
              </>
            ) : (
              <div className="space-y-4">
                <svg
                  className="mx-auto h-12 w-12 text-green-500"
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
                <div className="text-left bg-white rounded-lg p-4 shadow-sm">
                  <p className="font-semibold text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{formatFileSize(file.size)}</p>
                  <p className="text-sm text-gray-600">{file.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={uploading}
                  className="text-red-600 hover:text-red-700 underline disabled:opacity-50"
                >
                  Remove File
                </button>
              </div>
            )}

            {errors.file && <p className="mt-2 text-red-600 text-sm">{errors.file}</p>}
          </div>

          {/* Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={uploading}
              maxLength={200}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter video title"
            />
            <div className="flex justify-between mt-1">
              {errors.title && <p className="text-red-600 text-sm">{errors.title}</p>}
              <p className="text-gray-500 text-sm ml-auto">{title.length}/200</p>
            </div>
          </div>

          {/* Description Input */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={uploading}
              maxLength={2000}
              rows={4}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter video description"
            />
            <div className="flex justify-between mt-1">
              {errors.description && <p className="text-red-600 text-sm">{errors.description}</p>}
              <p className="text-gray-500 text-sm ml-auto">{description.length}/2000</p>
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-700">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {uploading ? 'Uploading...' : 'Upload Video'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={uploading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
