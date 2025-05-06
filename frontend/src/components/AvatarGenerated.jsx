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
          // Assuming the backend endpoint /api/session/:sessionId returns an object
          // with a `generated_avatars` array if they exist.
          // This part of the code seems to fetch session details, which might include
          // previously generated avatars. If this endpoint doesn't exist or doesn't
          // return `generated_avatars`, this `setGeneratedAvatarsObjects` call
          // might not behave as expected, but it's part of your original code.
          // The key is that any URLs fetched here should be fully qualified if they are to be displayed.
          const res = await axios.get(`${API_BASE_URL}/api/session/${sessionId}`); 
          if (res.data.generated_avatars && res.data.generated_avatars.length > 0) {
            // IMPORTANT: Ensure that if you are loading avatars from a previous session state
            // via this mechanism, their URLs are also fully qualified or handled correctly
            // by `currentAvatarSrc` logic. The `handleGenerate` function makes newly generated URLs
            // fully qualified.
            const avatars = res.data.generated_avatars.map(avatar => {
                // If URLs from backend are relative (e.g., /static/...), make them absolute
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
        // Not necessarily a critical error if the session is new or has no prior generated avatars.
      }
    };
    if (sessionId) { // Only fetch if sessionId is available
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
      
      // res.data.url from backend is relative, e.g., /static/generated/xyz.png
      // Prepend API_BASE_URL to make it a full URL.
      const newAvatarUrl = res.data.url.startsWith('http') ? res.data.url : `${API_BASE_URL}${res.data.url}`;
      
      // Use res.data.prompt as the source of truth for the prompt associated with the generated image.
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
    if (generatedAvatarsObjects.length > 0 && generatedAvatarsObjects[currentIndex]) { // Check if current index is valid
      const currentAvatar = generatedAvatarsObjects[currentIndex];
      // Pass an object with url and prompt
      onNext({ url: currentAvatar.url, prompt: currentAvatar.prompt }); 
    } else {
      console.warn("Confirm clicked but no avatars generated or current index is invalid.");
      // onNext(null); // Or handle appropriately if you want to signal no avatar was confirmed
    }
  };

  let currentAvatarSrc = kagamiPlaceholder;
  // Ensure generatedAvatarsObjects[currentIndex] exists before trying to access its properties
  if (generatedAvatarsObjects.length > 0 && generatedAvatarsObjects[currentIndex]) { 
    const rawUrl = generatedAvatarsObjects[currentIndex].url || "";
    // The URLs stored in generatedAvatarsObjects (from fetchSessionInfo or handleGenerate)
    // should already be fully qualified (http... or data:...).
    // The check for `rawUrl.length > 100` for base64 is a bit arbitrary and might not be robust.
    // It's better to rely on the URL format itself.
    if (rawUrl.startsWith("http") || rawUrl.startsWith("data:")) {
      currentAvatarSrc = rawUrl;
    } else if (rawUrl) { // If it's not empty but not a recognized format
      console.warn("Avatar URL is in an unexpected format:", rawUrl, "Attempting to use directly.");
      currentAvatarSrc = rawUrl; // Or try to prepend API_BASE_URL if it looks relative
    }
    // If rawUrl is empty, currentAvatarSrc remains kagamiPlaceholder
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
                e.target.onerror = null; // prevent infinite loop
                e.target.src = kagamiPlaceholder; // Fallback to placeholder
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

        <div className="text-center text-gray-300 mt-2 text-sm">
          {`${Math.max(0, MAX_GENERATIONS - generatedAvatarsObjects.length)}/${MAX_GENERATIONS} Avatar Generations Remain`}
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