import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../utils/api';

export default function AssignVideo({ videoId, onClose, onAssigned }) {
  const [viewers, setViewers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedViewers, setSelectedViewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchEmail, setSearchEmail] = useState('');

  useEffect(() => {
    fetchAssignments();
  }, [videoId]);

  const fetchAssignments = async () => {
    try {
      const response = await api.get(`/videos/${videoId}/assignments`);
      setAssignments(response.data.data.assignments);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  const searchViewers = async () => {
    if (!searchEmail.trim()) {
      setError('Please enter an email to search');
      return;
    }

    try {
      setLoading(true);
      setError('');
      // Search for users by email with viewer role
      const response = await api.get(`/auth/users?email=${searchEmail}&role=viewer`);
      setViewers(response.data.data?.users || []);
      
      if (viewers.length === 0) {
        setError('No viewers found with that email');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error searching for viewers');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (selectedViewers.length === 0) {
      setError('Please select at least one viewer');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.post(`/videos/${videoId}/assign`, {
        userIds: selectedViewers,
      });
      
      await fetchAssignments();
      setSelectedViewers([]);
      setViewers([]);
      setSearchEmail('');
      
      if (onAssigned) {
        onAssigned();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error assigning video');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (userId) => {
    try {
      setLoading(true);
      setError('');
      await api.delete(`/videos/${videoId}/assign/${userId}`);
      await fetchAssignments();
      
      if (onAssigned) {
        onAssigned();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error removing access');
    } finally {
      setLoading(false);
    }
  };

  const toggleViewer = (viewerId) => {
    setSelectedViewers(prev => 
      prev.includes(viewerId) 
        ? prev.filter(id => id !== viewerId)
        : [...prev, viewerId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Share Video with Viewers</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Search Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search for Viewers by Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchViewers()}
                placeholder="viewer@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={searchViewers}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                Search
              </button>
            </div>
          </div>

          {/* Search Results */}
          {viewers.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Viewers to Share With
              </label>
              <div className="border border-gray-200 rounded-lg divide-y">
                {viewers.map((viewer) => (
                  <label
                    key={viewer._id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedViewers.includes(viewer._id)}
                      onChange={() => toggleViewer(viewer._id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{viewer.name}</p>
                      <p className="text-sm text-gray-500">{viewer.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              {selectedViewers.length > 0 && (
                <button
                  onClick={handleAssign}
                  disabled={loading}
                  className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400"
                >
                  Assign to {selectedViewers.length} Viewer(s)
                </button>
              )}
            </div>
          )}

          {/* Current Assignments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currently Shared With ({assignments.length})
            </label>
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No viewers have access to this video yet
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y">
                {assignments.map((assignment) => (
                  <div
                    key={assignment._id}
                    className="flex items-center justify-between p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {assignment.userId.name}
                      </p>
                      <p className="text-sm text-gray-500">{assignment.userId.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnassign(assignment.userId._id)}
                      disabled={loading}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

AssignVideo.propTypes = {
  videoId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onAssigned: PropTypes.func,
};
