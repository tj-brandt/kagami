import React, { useState, useEffect, useRef } from 'react';
// import backgroundChat from '../assets/background_chat.png'; // Vanta will be the background
import kagamiPlaceholder from '../assets/avatars/kagami.png'; // Default kagami image
import axios from 'axios';
import arrowImg from '../assets/arrow.png';
import * as THREE from 'three'; // For Vanta
import FOG from 'vanta/dist/vanta.fog.min.js';

const API_BASE_URL = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
const MAX_GENERATIONS = 5;

export default function AvatarGenerated({ onNext, sessionId }) {
  const vantaRef = useRef(null); // Ref for Vanta
  const [generatedAvatarsObjects, setGeneratedAvatarsObjects] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Vanta.js Background Effect
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
        baseColor: 0xffffff, // Base color from ChatInterface
        blurFactor: 0.58,
        speed: 0.10
      });
    }

    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

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
      ref={vantaRef} // Apply vantaRef here
      id="vanta-bg" // Optional: if you have CSS targeting this
      className="w-screen h-screen flex flex-col items-center justify-between relative" // Removed bg-cover, bg-center
      style={{
        // backgroundImage: `url(${backgroundChat})`, // Removed: Vanta will be the background
        overflow: 'hidden' // Good practice for Vanta containers
      }}
    >
      {/* Top Instructions */}
      <div className="mt-8 text-center text-2xl font-semibold bg-gray-700 text-white px-6 py-2 rounded-full z-10"> {/* Added z-10 to ensure it's above Vanta if needed */}
        Using a few words, tell me what you look like!
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Avatar display + loading caption */}
      <div className="flex items-end justify-center gap-10 mb-0 z-10"> {/* Added z-10 */}
        <button onClick={handlePrev} aria-label="Previous Avatar" disabled={generatedAvatarsObjects.length <=1 || loading}>
          <img
            src={arrowImg}
            alt="Previous"
            className="w-10 h-10 transform hover:scale-110 transition relative -top-40 disabled:opacity-50"
          />
        </button>

        <div className="flex flex-col items-center">
          <img
            src={currentAvatarSrc}
            alt={currentAvatarSrc === kagamiPlaceholder ? "Kagami Placeholder" : (generatedAvatarsObjects[currentIndex]?.prompt || "Generated Avatar")}
            className={`w-96 h-auto object-contain ${loading ? 'animate-pulse' : ''}`}
            onError={(e) => {
                e.target.onerror = null; 
                e.target.src = kagamiPlaceholder;
            }}
          />
          {loading && (
            <div className="mt-2 text-sm text-sky-200 animate-pulse">Creating your avatar...</div>
          )}
        </div>

        <button onClick={handleNext} aria-label="Next Avatar" disabled={generatedAvatarsObjects.length <=1 || loading}>
          <img
            src={arrowImg}
            alt="Next"
            className="w-10 h-10 hover:scale-110 rotate-180 transition relative -top-40 disabled:opacity-50"
          />
        </button>
      </div>

      {/* Prompt input and generate */}
      <div className="w-full max-w-lg px-6 mb-4 z-10"> {/* Added z-10 */}
        {/* Notice about generation time */}
        <div className="text-center text-gray-800 text-sm mb-2">
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
            onKeyPress={(e) => { if (e.key === 'Enter' && !loading && promptInput.trim() && generatedAvatarsObjects.length < MAX_GENERATIONS) handleGenerate(); }}
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
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              '✨'
            )}
          </button>
        </div>

        <div className="text-center text-gray-800 mt-2 text-sm">
          {`${Math.max(0, MAX_GENERATIONS - generatedAvatarsObjects.length)}/${MAX_GENERATIONS} Avatar Generations Remain`}
        </div>
        {error && (
          <div className="text-center text-red-500 mt-2 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Confirm Button */}
      <div className="mb-6 z-10"> {/* Added z-10 */}
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