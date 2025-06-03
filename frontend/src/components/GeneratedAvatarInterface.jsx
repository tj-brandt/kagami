import React, { useState } from 'react';
import axios from 'axios';
import kagamiPlaceholder from '../assets/avatars/kagami.png';
import arrow from '../assets/arrow.png';

function GeneratedAvatarInterface({ sessionId, onGenerate, logFrontendEvent, apiBaseUrl }) {
  const [prompt, setPrompt] = useState('');
  const [generatedAvatars, setGeneratedAvatars] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const MAX_GENERATIONS = 5;
  const currentAvatar = generatedAvatars[currentIndex] || { url: kagamiPlaceholder, prompt: '' };

  const handleGenerateClick = async () => {
    if (!prompt.trim()) {
      setError("Please enter a description for your avatar.");
      return;
    }

    setIsLoading(true);
    setError(null);

    logFrontendEvent('generated_avatar_request_sent', { prompt_input: prompt });

    try {
      const res = await axios.post(`${apiBaseUrl.replace(/\/$/, '')}/api/avatar/generate`, {
        sessionId,
        prompt,
      });
      const newAvatar = { url: res.data.url, prompt };
      setGeneratedAvatars([...generatedAvatars, newAvatar]);
      setCurrentIndex(generatedAvatars.length);
      logFrontendEvent('generated_avatar_success_received', newAvatar);
      setPrompt('');
    } catch (err) {
      console.error("Error generating avatar:", err);
      setError("Failed to generate avatar. Please try again.");
      logFrontendEvent('generated_avatar_failed', { error_message: err.message, prompt_sent: prompt });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmClick = () => {
    if (generatedAvatars.length > 0) {
      onGenerate(generatedAvatars[currentIndex]);
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + generatedAvatars.length) % generatedAvatars.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % generatedAvatars.length);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 py-6">
      <div className="text-center text-lg font-bold mb-2">
        Using a few words, describe your ideal companion!
      </div>

      <div className="text-center text-sm mb-4 text-brand-primary dark:text-dark-text">
        {`${MAX_GENERATIONS - generatedAvatars.length}/${MAX_GENERATIONS} generations remain`}
      </div>

      <div className="flex justify-center items-center relative w-full max-w-[320px] mb-6">
        {/* Arrows */}
        {generatedAvatars.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Previous Avatar"
              className="absolute left-[-2.5rem] top-1/2 transform -translate-y-1/2 bg-brand-primary text-brand-primary border-4 border-brand-secondary rounded-[20px] w-12 h-12 flex items-center justify-center shadow-md hover:scale-105 transition"
            >
              <img src={arrow} alt="Previous" className="w-5 h-5 rotate-180" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next Avatar"
              className="absolute right-[-2.5rem] top-1/2 transform -translate-y-1/2 bg-brand-primary text-brand-primary border-4 border-brand-secondary rounded-[20px] w-12 h-12 flex items-center justify-center shadow-md hover:scale-105 transition"
            >
              <img src={arrow} alt="Next" className="w-5 h-5" />
            </button>
          </>
        )}

        <div className="w-full aspect-square rounded-[30px] overflow-hidden border-[10px] border-brand-primary dark:border-[#997D8A] bg-[#997D8A] dark:bg-bg-surface-light flex items-center justify-center">
          <img
            src={currentAvatar.url}
            alt="Generated Avatar"
            className={`w-full h-full object-contain ${isLoading ? 'animate-pulse' : ''}`}
          />
        </div>
      </div>

      <div className="w-full max-w-md flex flex-col items-center">
        <textarea
          className="w-full p-3 mb-4 rounded-medium border-div-sm border-[#997D8A] dark:border-dark-border bg-bg-surface-light dark:bg-dark-surface text-brand-primary dark:text-dark-text placeholder-text-dark dark:placeholder-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary dark:focus:ring-dark-text transition-colors duration-200"
          rows="3"
          placeholder="e.g., 'a stylish fox in a hoodie'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        ></textarea>
        <p className="text-xs text-brand-primary dark:text-dark-text mb-2 text-center">
          Generating may take up to <strong>30 seconds or longer</strong>. Please don’t close the tab!
        </p>
        <button
          onClick={handleGenerateClick}
          disabled={isLoading}
          className={`w-full px-6 py-3 rounded-large font-bold text-lg transition duration-300 ease-in-out flex items-center justify-center gap-2 ${
            isLoading
              ? 'bg-brand-accent text-brand-primary border-brand-primary cursor-not-allowed animate-pulse'
              : 'bg-brand-accent text-brand-primary border-brand-primary border-[3px] hover:bg-pink-300'
          }`}
        >
          {isLoading ? (
            <>
              <svg
                className="w-5 h-5 animate-spin text-pink-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating...
            </>
          ) : (
            'Generate Avatar'
          )}
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {generatedAvatars.length > 0 && (
        <button
          onClick={handleConfirmClick}
          className="mt-6 w-4/5 max-w-sm px-6 py-3 rounded-large border-button border-brand-primary dark:border-dark-text font-bold text-lg bg-brand-primary text-bg-light dark:bg-dark-text dark:text-dark-bg hover:bg-brand-secondary hover:text-brand-primary dark:hover:bg-dark-surface dark:hover:text-dark-text transition duration-300 ease-in-out"
        >
          Confirm Avatar
        </button>
      )}
    </div>
  );
}

export default GeneratedAvatarInterface;
