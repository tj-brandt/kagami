import React, { useState, useEffect, useRef } from 'react';
import kagamiPlaceholder from '../assets/avatars/kagami.png';
import axios from 'axios';
import arrowImg from '../assets/arrow.png';
import * as THREE from 'three';
import FOG from 'vanta/dist/vanta.fog.min.js';

const API_BASE_URL = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
const MAX_GENERATIONS = 5;

export default function AvatarGenerated({ onNext, sessionId }) {
  const vantaRef = useRef(null);
  const [generatedAvatarsObjects, setGeneratedAvatarsObjects] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const isMobile = window.innerWidth < 640; 
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = ''; 
    };
  }, []);

  useEffect(() => {
    let vantaEffect = null;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && vantaRef.current) {
      vantaEffect = FOG({
        el: vantaRef.current,
        THREE: THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        highlightColor: 0xffffff,
        midtoneColor: 0xe1e1e1,
        lowlightColor: 0xc5c5c5,
        baseColor: 0xffffff,
        blurFactor: 0.58,
        speed: 0.10
      });
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, []);

  useEffect(() => {
    const fetchSessionInfo = async () => {
      try {
        if (sessionId) {
          const res = await axios.get(`${API_BASE_URL}/api/session/${sessionId}`);
          if (res.data.generated_avatars && res.data.generated_avatars.length > 0) {
            const avatars = res.data.generated_avatars.map(avatar => {
              if (avatar.url && !avatar.url.startsWith('http') && !avatar.url.startsWith('data:')) {
                return { ...avatar, url: `${API_BASE_URL}${avatar.url}` };
              }
              return avatar;
            });
            setGeneratedAvatarsObjects(avatars);
            setCurrentIndex(avatars.length - 1);
          }
        }
      } catch (err) {
        console.error('Failed to fetch session info (this might be okay if no prior avatars):', err);
      }
    };
    if (sessionId) {
      fetchSessionInfo();
    }
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

      const newAvatarUrl = res.data.url.startsWith('http') ? res.data.url : `${API_BASE_URL}${res.data.url}`;
      const newAvatarObject = { url: newAvatarUrl, prompt: res.data.prompt };

      setGeneratedAvatarsObjects(prev => {
        const updated = [...prev, newAvatarObject];
        setCurrentIndex(updated.length - 1);
        return updated;
      });
      setPromptInput('');
    } catch (err) {
      console.error('Avatar generation failed:', err);
      if (err.response?.status === 400 && err.response?.data?.detail?.includes("Maximum avatar generations reached")) {
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
    if (generatedAvatarsObjects.length > 0 && generatedAvatarsObjects[currentIndex]) {
      const currentAvatar = generatedAvatarsObjects[currentIndex];
      onNext({ url: currentAvatar.url, prompt: currentAvatar.prompt });
    } else {
      console.warn("Confirm clicked but no avatars generated or current index is invalid.");
    }
  };

  let currentAvatarSrc = kagamiPlaceholder;
  if (generatedAvatarsObjects.length > 0 && generatedAvatarsObjects[currentIndex]) {
    const rawUrl = generatedAvatarsObjects[currentIndex].url || "";
    if (rawUrl.startsWith("http") || rawUrl.startsWith("data:")) {
      currentAvatarSrc = rawUrl;
    } else if (rawUrl) {
      console.warn("Avatar URL is in an unexpected format:", rawUrl, "Attempting to use directly.");
      currentAvatarSrc = rawUrl;
    }
  }

  return (
    <div
      ref={vantaRef}
      id="vanta-bg"
      // MODIFIED: Removed justify-between, added padding
      className="w-screen h-screen flex flex-col items-center relative overflow-hidden pt-4 pb-4 sm:pt-6 sm:pb-6"
    >
      {/* Top Instructions */}
      <div className="text-center text-lg sm:text-xl md:text-2xl font-semibold bg-gray-700 bg-opacity-70 text-white px-4 py-2 sm:px-6 rounded-full z-10">
        Using a few words, tell me what you look like!
      </div>

      {/* Middle Section: Avatar, Prompt, Generations, Confirm Button */}
      <div className="flex-grow w-full flex flex-col justify-center items-center px-4 z-10 overflow-y-auto py-2">
        {/* Avatar display + arrows */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-4 w-full max-w-md sm:max-w-lg">
          <button onClick={handlePrev} aria-label="Previous Avatar" disabled={generatedAvatarsObjects.length <= 1 || loading} className="p-2 rounded-full hover:bg-gray-500 hover:bg-opacity-20 transition-colors">
            <img
              src={arrowImg}
              alt="Previous"
              className="w-6 h-5 sm:w-8 sm:h-6 hover:scale-110 transition-transform disabled:opacity-50"
            />
          </button>

          <div className="flex flex-col items-center flex-shrink min-w-0"> {/* Added flex-shrink and min-w-0 for safety */}
            <img
              src={currentAvatarSrc}
              alt={currentAvatarSrc === kagamiPlaceholder ? "Kagami Placeholder" : (generatedAvatarsObjects[currentIndex]?.prompt || "Generated Avatar")}
              // MODIFIED: Responsive width for avatar, adjusted max-h
              className={`w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain ${loading ? 'animate-pulse' : ''}`}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = kagamiPlaceholder;
              }}
            />
            {loading && (
              <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-sky-200 animate-pulse">Creating your avatar...</div>
            )}
          </div>

          <button onClick={handleNext} aria-label="Next Avatar" disabled={generatedAvatarsObjects.length <= 1 || loading} className="p-2 rounded-full hover:bg-gray-500 hover:bg-opacity-20 transition-colors">
            <img
              src={arrowImg}
              alt="Next"
              className="w-6 h-5 sm:w-8 sm:h-6 rotate-180 hover:scale-110 transition-transform disabled:opacity-50"
            />
          </button>
        </div>

        {/* Prompt input, generate button, and messages */}
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-md mb-3 sm:mb-4">
          <div className="text-center text-gray-800 text-xs sm:text-sm mb-1 sm:mb-2">
            Generating your avatar may take up to 30 seconds.
          </div>

          <div className="flex items-center bg-white rounded-full shadow-md px-3 py-1.5 sm:px-4 sm:py-2">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Panda with sunglasses"
              // MODIFIED: Responsive text size
              className="flex-1 border-none focus:outline-none text-sm sm:text-base md:text-lg bg-transparent"
              disabled={generatedAvatarsObjects.length >= MAX_GENERATIONS || loading}
              onKeyPress={(e) => { if (e.key === 'Enter' && !loading && promptInput.trim() && generatedAvatarsObjects.length < MAX_GENERATIONS) handleGenerate(); }}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || generatedAvatarsObjects.length >= MAX_GENERATIONS || !promptInput.trim()}
              // MODIFIED: Responsive padding for button
              className={`ml-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 flex items-center justify-center transition ${loading || generatedAvatarsObjects.length >= MAX_GENERATIONS || !promptInput.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-sky-500 hover:bg-sky-400 text-white'
                }`}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                '✨'
              )}
            </button>
          </div>

          <div className="text-center text-gray-800 mt-1 sm:mt-2 text-xs sm:text-sm">
            {`${Math.max(0, MAX_GENERATIONS - generatedAvatarsObjects.length)}/${MAX_GENERATIONS} Generations Remain`}
          </div>
          {error && (
            <div className="text-center text-red-400 mt-1 sm:mt-2 text-xs sm:text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Confirm Button */}
        <div className="z-10"> {/* No specific margin needed here, controlled by parent's flex properties */}
          <button
            onClick={handleConfirm}
            disabled={generatedAvatarsObjects.length === 0 || loading}
            // MODIFIED: Responsive padding for button
            className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-full transition text-sm sm:text-base font-medium ${generatedAvatarsObjects.length === 0 || loading
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                : 'bg-sky-700 text-white hover:bg-sky-600 active:bg-sky-800 shadow-md'
              }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}