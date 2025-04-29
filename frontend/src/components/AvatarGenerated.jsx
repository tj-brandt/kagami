import React, { useState, useEffect } from 'react';
import backgroundChat from '../assets/background_chat.png';
import capybaraPlaceholder from '../assets/avatars/capybara.png'; // Default capybara image
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const MAX_GENERATIONS = 5;

export default function AvatarGenerated({ onNext, sessionId }) {  // <-- pass sessionId here
  // Revised state structure: stores { url, prompt } objects
  const [generatedAvatarsObjects, setGeneratedAvatarsObjects] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Revised useEffect to fetch objects
  useEffect(() => {
    const fetchSessionInfo = async () => {
      try {
        // Ensure sessionId is available before making the GET request
        if (sessionId) {
          const res = await axios.get(`${API_BASE_URL}/api/session/${sessionId}`);
          // The backend returns { url, prompt } objects in generated_avatars
          if (res.data.generated_avatars && res.data.generated_avatars.length > 0) {
            const avatars = res.data.generated_avatars; // This should be an array of {url, prompt}
            setGeneratedAvatarsObjects(avatars);
            setCurrentIndex(avatars.length - 1); // Show the most recent avatar
          }
        }
      } catch (err) {
        console.error('Failed to fetch session info:', err);
        // Optionally set an error state if failing to load previous avatars is critical
      }
    };

    // Fetch session info when sessionId becomes available or on component mount if already available
    fetchSessionInfo();

  }, [sessionId]); // Rerun effect if sessionId changes (though it shouldn't after initial load)


  // Revised handleGenerate to add objects
  const handleGenerate = async () => {
    // Basic validation before attempting generation
    if (!promptInput.trim()) {
      setError("Please enter a prompt.");
      return;
    }
    if (generatedAvatarsObjects.length >= MAX_GENERATIONS) {
      setError("You've reached the maximum number of avatar generations.");
      return;
    }
    // Ensure sessionId is available before sending the request
    if (!sessionId) {
       setError("Session ID is missing. Cannot generate avatar.");
       console.error("Attempted to generate avatar with missing sessionId.");
       return;
    }


    setLoading(true);
    setError(null); // Clear previous errors
    try {
      const currentPrompt = promptInput.trim(); // Capture prompt before clearing input
      const requestBody = {
        prompt: currentPrompt,
        sessionId: sessionId,
      };
      console.log("Sending avatar generation request body:", requestBody); // <--- Add this log

      const res = await axios.post(`${API_BASE_URL}/api/avatar/generate`, requestBody);

      const backendBaseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
      const newAvatarUrl = `${backendBaseUrl}${res.data.url}`;
      console.log("Generated avatar URL:", newAvatarUrl);
      const newAvatarObject = { url: newAvatarUrl, prompt: currentPrompt }; // Create the object

      // Update state with the new avatar object
      setGeneratedAvatarsObjects(prev => {
        const updatedAvatars = [...prev, newAvatarObject];
        setCurrentIndex(updatedAvatars.length - 1); // move to the newly generated avatar
        return updatedAvatars;
      });
      setPromptInput(''); // Clear the input field

    } catch (err) {
      console.error('Avatar generation failed:', err);
      if (err.response?.status === 400 && err.response?.data?.detail === "Maximum avatar generations reached for this session.") {
         setError("You've reached the maximum number of avatar generations!");
      } else if (err.response?.status === 404 && err.response?.data?.detail === "Session not found") {
          setError("Your session was not found. Please try starting over.");
      }
      else {
        setError("Failed to generate avatar. Please try again: " + (err.response?.data?.detail || err.message)); // More specific error message
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (generatedAvatarsObjects.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + generatedAvatarsObjects.length) % generatedAvatarsObjects.length);
    }
  };

  const handleNext = () => {
     if (generatedAvatarsObjects.length > 1) {
       setCurrentIndex((prev) => (prev + 1) % generatedAvatarsObjects.length);
     }
  };

  // Revised handleConfirm to use the object
  const handleConfirm = () => {
    if (generatedAvatarsObjects.length > 0) {
      onNext(generatedAvatarsObjects[currentIndex].url); // ONLY the URL
    } else {
      console.warn("Confirm clicked but no avatars generated.");
    }
  };


   let currentAvatarSrc = capybaraPlaceholder; // Default if no avatars
   if (generatedAvatarsObjects.length > 0) {
     const rawUrl = generatedAvatarsObjects[currentIndex].url || "";
     if (rawUrl.startsWith("http")) {
       currentAvatarSrc = rawUrl;  // Good normal URL
     } else if (rawUrl.length > 100) {
       // Looks like raw base64 (VERY long string) but missing "data:image/png;base64,"
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

      {/* Arrows and Avatar */}
      <div className="flex items-end justify-center gap-10 mb-0">
        {/* Use generatedAvatarsObjects.length */}
        <button onClick={handlePrev} disabled={generatedAvatarsObjects.length <= 1 || loading}>
          <span className="text-5xl">←</span>
        </button>

        <img
          src={currentAvatarSrc}
          alt="Avatar"
          className={`w-96 h-auto object-contain ${loading ? 'animate-pulse' : ''}`} // Pulse while loading
        />

        {/* Use generatedAvatarsObjects.length */}
        <button onClick={handleNext} disabled={generatedAvatarsObjects.length <= 1 || loading}>
          <span className="text-5xl">→</span>
        </button>
      </div>

      {/* Prompt input and generate */}
      <div className="w-full max-w-lg px-6 mb-4">
        <div className="flex items-center bg-white rounded-full shadow-md px-4 py-2">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="e.g., Panda with sunglasses"
            className="flex-1 border-none focus:outline-none text-lg"
            disabled={generatedAvatarsObjects.length >= MAX_GENERATIONS || loading} // Disable input while loading or maxed out
          />
          <button
            onClick={handleGenerate}
            disabled={loading || generatedAvatarsObjects.length >= MAX_GENERATIONS || !promptInput.trim()} // Disable generate if loading, maxed, or input is empty
            className={`ml-2 rounded-full px-4 py-2 transition ${
              loading || generatedAvatarsObjects.length >= MAX_GENERATIONS || !promptInput.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {loading ? '...' : '✨'}
          </button>
        </div>
        {/* Use generatedAvatarsObjects.length */}
        <div className="text-center text-gray-500 mt-2 text-sm">
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
        {/* Disable confirm if no avatars generated or while loading */}
        <button
          onClick={handleConfirm}
          disabled={generatedAvatarsObjects.length === 0 || loading}
          className={`px-6 py-3 rounded-full transition ${
            generatedAvatarsObjects.length === 0 || loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}


