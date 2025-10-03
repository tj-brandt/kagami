// frontend/src/services/api.js
import axios from 'axios';
import axiosRetry from 'axios-retry';

const API_BASE_URL = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

// Create an Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axios.isAxiosError(error) && error.response?.status >= 500;
  },
});

// --- API Functions ---

export const startSession = async (participantId, conditionName) => {
  const response = await apiClient.post('/api/session/start', { participantId, conditionName });
  return response.data;
};

export const sendMessage = async (sessionId, message) => {
  const response = await apiClient.post('/api/session/message', { sessionId, message });
  return response.data; 
};

export const setAvatarDetails = async (sessionId, avatarUrl, avatarPrompt = null) => {
  const payload = { sessionId, avatarUrl };
  if (avatarPrompt) payload.avatarPrompt = avatarPrompt;
  await apiClient.post('/api/session/set_avatar_details', payload);
};

export const generateAvatar = async (sessionId, prompt) => {
    const response = await apiClient.post('/api/avatar/generate', { sessionId, prompt });
    return response.data;
};

export const endSession = (sessionId) => {
  const url = `${API_BASE_URL}/api/session/end`;
  const data = JSON.stringify({ sessionId });
  if (navigator.sendBeacon) {
    const blob = new Blob([data], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    apiClient.post('/api/session/end', { sessionId });
  }
};

export const logFrontendEvent = async (payload) => {
  await apiClient.post('/api/log/frontend_event', payload);
};