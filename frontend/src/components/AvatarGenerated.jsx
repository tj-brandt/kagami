import React, { useState, useEffect } from 'react';
import backgroundChat from '../assets/background_chat.png';
import kagamiPlaceholder from '../assets/avatars/kagami.png'; // Default kagami image
import axios from 'axios';
import arrowImg from '../assets/arrow.png';

const API_BASE_URL = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
const MAX_GENERATIONS = 5;

export default function AvatarGenerated({ onNext, sessionId }) {
  const [generatedAvatarsObjects, setGeneratedAvatarsObjects] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSessionInfo = async () => {
      try {
        if (sessionId) {
          const res = await axios.get(`${API_BASE_URL}/api/session/${sessionId}`);
          if (res.data.generated_avatars && res.data.generated_avatars.length > 0) {
            const avatars = res.data.generated_avatars;
            setGeneratedAvatarsObjects(avatars);
            setCurrentIndex(avatars.length - 1);
          }
        }
      } catch (err) {
        console.error('Failed to fetch session info:', err);
      }
    };
    fetchSessionInfo();
  }, [sessionId]);

  const handleGenerate = async () => {
    if (!promptInput.trim()) {
      setError("Please enter a prompt.");
      return;
    }
    if (generatedAvatarsObjects.length >= MAX_GENERATIONS) {
      setError("You've reached the maximum number of avatar generations.");
      return;
    }
    if (!sessionId) {
      setError("Session ID is missing. Cannot generate avatar.");
      console.error("Attempted to generate avatar with missing sessionId.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const currentPrompt = promptInput.trim();
      const requestBody = { prompt: currentPrompt, sessionId };
      const res = await axios.post(`${API_BASE_URL}/api/avatar/generate`, requestBody);
      const newAvatarUrl = `${API_BASE_URL}${res.data.url}`;
      const newAvatarObject = { url: newAvatarUrl, prompt: currentPrompt };
      setGeneratedAvatarsObjects(prev => {
        const updated = [...prev, newAvatarObject];
        setCurrentIndex(updated.length - 1);
        return updated;
      });
      setPromptInput('');
    } catch (err) {
      console.error('Avatar generation failed:', err);
      if (err.response?.status === 400 && err.response?.data?.detail === "Maximum avatar generations reached for this session.") {
        setError("You've reached the maximum number of avatar generations!");
      } else if (err.response?.status === 404 && err.response?.data?.detail === "Session not found") {
        setError("Your session was not found. Please try starting over.");
      } else {
        setError("Failed to generate avatar. Please try again: " + (err.response?.data?.detail || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (generatedAvatarsObjects.length > 1) {
      setCurrentIndex(prev => (prev - 1 + generatedAvatarsObjects.length) % generatedAvatarsObjects.length);
    }
  };

  const handleNext = () => {
    if (generatedAvatarsObjects.length > 1) {
      setCurrentIndex(prev => (prev + 1) % generatedAvatarsObjects.length);
    }
  };

  const handleConfirm = () => {
    if (generatedAvatarsObjects.length > 0) {
      onNext(generatedAvatarsObjects[currentIndex].url);
    } else {
      console.warn("Confirm clicked but no avatars generated.");
    }
  };

  let currentAvatarSrc = kagamiPlaceholder;
  if (generatedAvatarsObjects.length > 0) {
    const rawUrl = generatedAvatarsObjects[currentIndex].url || "";
    if (rawUrl.startsWith("http")) {
      currentAvatarSrc = rawUrl;
    } else if (rawUrl.length > 100) {
      currentAvatarSrc = `data:image/png;base64,${rawUrl}`;
    } else {
      console.warn("Avatar URL is invalid format:", rawUrl);
    }
  }

  return (
    <div
      className="w-screen h-screen bg-cover bg-center flex flex-col items-center justify-between relative"
      style={{ backgroundImage: `url(${backgroundChat})` }}
    >
      {/* Top Instructions */}
      <div className="mt-8 text-center text-2xl font-semibold bg-gray-700 text-white px-6 py-2 rounded-full">
        Using a few words, tell me what you look like!
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Avatar display + loading caption */}
      <div className="flex items-end justify-center gap-10 mb-0">
        <button onClick={handlePrev} aria-label="Previous Avatar">
          <img
            src={arrowImg}
            alt="Previous"
            className="w-10 h-10 transform hover:scale-110 transition relative -top-40"
          />
        </button>

        <div className="flex flex-col items-center">
          <img
            src={currentAvatarSrc}
            alt="Avatar"
            className={`w-96 h-auto object-contain ${loading ? 'animate-pulse' : ''}`}
          />
          {loading && (
            <div className="mt-2 text-sm text-sky-200 animate-pulse">Creating your avatar...</div>
          )}
        </div>

        <button onClick={handleNext} aria-label="Next Avatar">
          <img
            src={arrowImg}
            alt="Next"
            className="w-10 h-10 hover:scale-110 rotate-180 transition relative -top-40"
          />
        </button>
      </div>

      {/* Prompt input and generate */}
      <div className="w-full max-w-lg px-6 mb-4">
        {/* Notice about generation time */}
        <div className="text-center text-yellow-200 text-sm mb-2">
          Generating your avatar may take up to 30 seconds — hang tight!
        </div>

        <div className="flex items-center bg-white rounded-full shadow-md px-4 py-2">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Panda with sunglasses"
            className="flex-1 border-none focus:outline-none text-lg"
            disabled={generatedAvatarsObjects.length >= MAX_GENERATIONS || loading}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || generatedAvatarsObjects.length >= MAX_GENERATIONS || !promptInput.trim()}
            className={`ml-2 rounded-full px-4 py-2 flex items-center justify-center transition ${
              loading || generatedAvatarsObjects.length >= MAX_GENERATIONS || !promptInput.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-sky-500 hover:bg-sky-400 text-white'
            }`}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            ) : (
              '✨'
            )}
          </button>
        </div>

        <div className="text-center text-gray-300 mt-2 text-sm">
          {`${MAX_GENERATIONS - generatedAvatarsObjects.length}/${MAX_GENERATIONS} Avatar Generations Remain`}
        </div>
        {error && (
          <div className="text-center text-red-500 mt-2 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Confirm Button */}
      <div className="mb-6">
        <button
          onClick={handleConfirm}
          disabled={generatedAvatarsObjects.length === 0 || loading}
          className={`px-6 py-3 rounded-full transition ${
            generatedAvatarsObjects.length === 0 || loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-sky-800 text-white hover:bg-sky-900'
          }`}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
