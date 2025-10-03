// src/components/IntroductionScreen.jsx
import React, { useState, useEffect } from 'react';
import useSessionStore from '../store/sessionStore';
import kagamiIntroAvatar from '../assets/avatars/kagamicrop.webp';

function IntroductionScreen({ logFrontendEvent, onContinue }) {
  const condition = useSessionStore((state) => state.condition);
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    if (condition) {
      logFrontendEvent('intro_screen_viewed', { condition_name: condition.name });
    }
  }, [condition, logFrontendEvent]);

  if (!condition) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-foreground/60">Loading introduction...</p>
      </div>
    );
  }

  const isNoAvatar = !condition.avatar;

  const handleCheckboxChange = (e) => {
    setUnderstood(e.target.checked);
  };

  const handleContinue = () => {
    if (understood) {
      onContinue();
    } else {
      logFrontendEvent('intro_continue_blocked', { reason: 'not_understood_checked' });
    }
  };

  return (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-foreground mb-2">
        Hi, I’m Kagami!
      </h1>
      <h2 className="text-xl sm:text-2xl text-foreground/80 mb-8">
        Welcome to Kagami Chat
      </h2>

      <div className="space-y-4 text-base sm:text-lg text-foreground/90 text-left leading-relaxed">
        {!isNoAvatar && (
            <img
                src={kagamiIntroAvatar}
                alt="Kagami"
                className="float-right w-32 h-32 ml-4 mb-2 object-contain shape-circle"
            />
        )}
        <p>This is a friendly chat with Kagami, your virtual chat companion, as part of a research study.</p>
        <p>Kagami will do its best to match your vibe and make you feel at home. Please note that this isn’t real advice or a professional service.</p>
        <p>Everything you say stays private and will only be used for research in a safe, confidential way. You can leave whenever you like.</p>
        <p className="font-medium text-foreground py-2">
            You will have <span className="font-semibold">10 minutes</span> to chat before the session ends automatically.
            <br />
            <span className="text-red-600 dark:text-red-400 font-semibold">Please do not leave this browser window.</span>
            <br />
            Once the chat ends, you will be automatically redirected to a final survey.
        </p>
      </div>

      {/* Controls */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
        <label
          htmlFor="understand-checkbox"
          className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-card transition-colors"
        >
          <input
            id="understand-checkbox"
            type="checkbox"
            checked={understood}
            onChange={handleCheckboxChange}
            className="w-5 h-5 rounded bg-card border-border text-accent focus:ring-accent"
          />
          <span className="font-medium text-foreground">I understand and wish to continue</span>
        </label>
        
        <button
          onClick={handleContinue}
          disabled={!understood}
          className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-base
                     bg-primary text-primary-foreground
                     hover:bg-primary/90
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/80
                     disabled:bg-primary/50 disabled:cursor-not-allowed
                     transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export default IntroductionScreen;