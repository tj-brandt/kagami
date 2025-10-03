// src/components/GeneratedAvatarInterface.jsx
import React, { useState } from 'react';
import * as api from '../services/api';
import { SparklesIcon } from '@heroicons/react/24/solid';

const Spinner = () => (
    <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

function GeneratedAvatarInterface({ sessionId, onAvatarGenerated, logFrontendEvent, kagamiPlaceholder }) {
  const [prompt, setPrompt] = useState('');
  const [generatedAvatars, setGeneratedAvatars] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const MAX_GENERATIONS = 5;
  const PROMPT_CHAR_LIMIT = 150;
  const remainingChars = PROMPT_CHAR_LIMIT - prompt.length;

  const handleGenerateClick = async () => {
    if (!prompt.trim() || isLoading || generatedAvatars.length >= MAX_GENERATIONS || remainingChars < 0) {
      return;
    }

    setIsLoading(true);
    setError('');
    logFrontendEvent('generate_avatar_clicked', { prompt });

    try {
      const newAvatarData = await api.generateAvatar(sessionId, prompt);
      setGeneratedAvatars(prev => [...prev, newAvatarData]);
    } catch (err) {
      console.error('Avatar generation failed:', err);
      const errorMessage = err.response?.data?.detail || 'Could not generate avatar. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmClick = (avatarData) => {
    const fullUrl = new URL(avatarData.url, BACKEND_URL).href;
    onAvatarGenerated({
        ...avatarData,
        url: fullUrl
    });
  };
  
  return (
    <div className="w-full flex flex-col items-center">

      <div className="w-full max-w-xl p-6 mb-8 bg-card border border-border rounded-lg text-left">
        <div className="flex flex-col sm:flex-row items-start gap-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A wise old owl wearing reading glasses"
            disabled={isLoading || generatedAvatars.length >= MAX_GENERATIONS}
            rows={3}
            maxLength={PROMPT_CHAR_LIMIT}
            className="flex-grow w-full p-3 rounded-md bg-background border border-border focus:ring-2 focus:ring-accent focus:border-accent transition-colors resize-none"
          />
          <button
            onClick={handleGenerateClick}
            disabled={!prompt.trim() || isLoading || generatedAvatars.length >= MAX_GENERATIONS || remainingChars < 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/60 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {isLoading && generatedAvatars.length === 0 ? <Spinner /> : <SparklesIcon className="h-5 w-5" />}
            <span>{isLoading ? 'Generating...' : 'Generate'}</span>
          </button>
        </div>
        <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-foreground/60">
                Generations can take up to 30 seconds. Please be patient.
            </p>
            <p className={`text-xs font-medium ${remainingChars < 20 ? 'text-red-500' : 'text-foreground/60'}`}>
                {remainingChars} / {PROMPT_CHAR_LIMIT}
            </p>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="w-full">
        {generatedAvatars.length === 0 && (
          <div className="flex flex-col items-center animate-fadeIn">
            <p className="text-foreground/70 mb-4">You'll be creating a companion in this style:</p>
            <div className="w-48 h-48 sm:w-64 sm:h-64 p-2 rounded-lg bg-card border border-border">
              <img src={kagamiPlaceholder} alt="Example Avatar" className="w-full h-full object-contain"/>
            </div>
             {isLoading && (
                <div className="mt-4 flex items-center gap-2 text-foreground/80">
                    <Spinner/>
                    <span>Creating your first companion...</span>
                </div>
            )}
          </div>
        )}

        {generatedAvatars.length > 0 && (
          <div className="flex flex-col items-center animate-fadeIn">
            <h2 className="text-2xl font-serif text-foreground mb-4">Your Creations</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {generatedAvatars.map((avatar, index) => {
                const fullImageUrl = new URL(avatar.url, BACKEND_URL).href;
                return (
                  <div key={index} className="flex flex-col items-center gap-2 group">
                    <div className="w-32 h-32 sm:w-40 sm:h-40 p-2 rounded-lg bg-card border border-border relative overflow-hidden">
                      <img src={fullImageUrl} alt={avatar.prompt} className="w-full h-full object-contain" />
                      {isLoading && index === generatedAvatars.length - 1 && (
                         <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Spinner />
                         </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleConfirmClick(avatar)}
                      className="w-full text-center text-sm px-3 py-2 rounded-md font-medium bg-card text-foreground/80 border border-transparent hover:bg-primary hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GeneratedAvatarInterface;