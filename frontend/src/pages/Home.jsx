import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { healthAPI } from '../utils/api';

function Home() {
  const { isAuthenticated, user } = useAuth();
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await healthAPI.check();
        setApiStatus(response.data);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to check API health');
        setApiStatus(null);
      } finally {
        setLoading(false);
      }
    };

    checkApiHealth();
  }, []);

  // Role-specific feature list
  const getRoleFeatures = (role) => {
    const features = {
      viewer: [
        'View video content',
        'Browse video library',
        'Access public videos',
        'Read-only dashboard access',
      ],
      editor: [
        'View video content',
        'Upload new videos',
        'Edit video metadata',
        'Manage video transcoding',
        'Access editor dashboard',
      ],
      admin: [
        'Full system access',
        'User management',
        'System configuration',
        'Analytics dashboard',
        'Manage all content',
        'Access control settings',
      ],
    };
    return features[role] || [];
  };

  return (
    <div className="px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Video Processing Platform
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Upload, process, and stream videos with content sensitivity analysis and real-time
          progress tracking.
        </p>

        {/* Authentication prompt for non-authenticated users */}
        {!isAuthenticated && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-indigo-900 mb-2">
              Get Started
            </h2>
            <p className="text-indigo-700 mb-4">
              Sign in or create an account to access video processing features.
            </p>
            <div className="flex space-x-4">
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}

        {/* Role-based features for authenticated users */}
        {isAuthenticated && user && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-green-900 mb-2">
              Welcome back, {user.name}!
            </h2>
            <p className="text-green-700 mb-3">
              You are signed in as{' '}
              <span className="font-semibold">{user.role}</span>
            </p>
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-green-900 mb-2">
                Your Permissions:
              </h3>
              <ul className="space-y-1">
                {getRoleFeatures(user.role).map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-green-800">
                    <svg
                      className="h-4 w-4 text-green-600 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">API Health Status</h2>

          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p className="font-semibold">Unable to connect to API</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {apiStatus && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">Status:</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  {apiStatus.data.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">Environment:</span>
                <span className="text-gray-900">{apiStatus.data.environment}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">Database:</span>
                <span className="text-gray-900">{apiStatus.data.database.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">Uptime:</span>
                <span className="text-gray-900">
                  {Math.floor(apiStatus.data.uptime)} seconds
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Getting Started</h3>
          <p className="text-blue-700">
            This is Phase 1 of the project. More features will be added in subsequent phases
            including video upload, processing, and streaming capabilities.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Home;
