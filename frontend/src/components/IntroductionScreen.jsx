import React, { useState, useEffect } from 'react';

function IntroductionScreen({ condition, logFrontendEvent, onContinue, kagamiIntroAvatar }) {
  const [understood, setUnderstood] = useState(false);

  const isNoAvatar = condition?.toLowerCase().includes('noavatar');

  useEffect(() => {
    logFrontendEvent('intro_screen_viewed', { condition_name: condition });
  }, [condition, logFrontendEvent]);

  const handleCheckboxChange = (e) => {
    setUnderstood(e.target.checked);
  };

  const handleContinue = () => {
    if (understood) {
      logFrontendEvent('intro_continue_clicked', { understood_checked: true });
      onContinue();
    } else {
      alert("Please confirm you understand by checking the box.");
      logFrontendEvent('intro_continue_blocked', { reason: 'not_understood_checked' });
    }
  };

  return (
    <div className="flex flex-col items-center h-full w-full p-4 bg-bg-surface-light dark:bg-dark-bg text-brand-primary dark:text-dark-text transition-colors duration-500">
      {/* Content container */}
      <div className="w-full max-w-lg px-4 leading-relaxed relative">
        {isNoAvatar ? (
          // --- No Avatar Layout (Centered) ---
          <div className="flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold mb-2">Hi, I’m Kagami!</h2>
            <h3 className="text-xl font-semibold mb-4">Welcome to Kagami Chat!</h3>

            <p className="mb-2">Just a heads up: this is a friendly chat with Kagami, your virtual chat companion.</p>
            <p className="mb-2">Kagami will do their best to match your vibe and make you feel at home. This isn’t real advice or a real service — it’s just for fun and to help us learn how people experience AI conversations.</p>
            <p className="mb-2">Everything you say stays private and will only be used for research in a safe, confidential way. You can leave whenever you like.</p>
            <p className="font-semibold mb-4 text-brand-primary dark:text-dark-text">
                You will have 10 minutes to chat before the session ends automatically.
                <br/>
                <span className="text-red-500 dark:text-red-300 font-bold">Please DO NOT leave this chat window.</span>
                <br/>
                Once the chat ends, you will be automatically redirected to a final survey.
            </p>          </div>
        ) : (
          // --- Avatar Layout (Float Right) ---
          <div className="text-left">
            <h2 className="text-2xl font-bold mb-1">Hi, I’m Kagami!</h2>
            <h3 className="text-xl font-semibold mb-4">Welcome to Kagami Chat!</h3>
            <div className="mb-6">
              <img
                src={kagamiIntroAvatar}
                alt="Kagami"
                className="float-right w-48 h-48 ml-4 mb-2 object-contain"
              />
              <p className="mb-2">Just a heads up: this is a friendly chat with Kagami, your virtual chat companion.</p>
              <p className="mb-2">Kagami will do their best to match your vibe and make you feel at home. This isn’t real advice or a real service — it’s just for fun and to help us learn how people experience AI conversations.</p>
              <p className="mb-2">Everything you say stays private and will only be used for research in a safe, confidential way. You can leave whenever you like.</p>
              <p className="font-semibold mb-4 text-brand-primary dark:text-dark-text">
                You will have 10 minutes to chat before the session ends automatically.
                <br/>
                <span className="text-red-500 dark:text-red-300 font-bold">Please DO NOT leave the chat window.</span>
                <br/>
                Once the chat ends, you will be automatically redirected to a final survey.
            </p>
                        </div>
          </div>
        )}

        {/* Buttons section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-10">
          {/* Understand Checkbox Button */}
          <label htmlFor="understand-checkbox" className="flex items-center px-4 py-3 border-4 border-brand-primary rounded-medium bg-brand-secondary text-brand-primary font-bold cursor-pointer hover:opacity-90 transition">
            <input
              id="understand-checkbox"
              type="checkbox"
              checked={understood}
              onChange={handleCheckboxChange}
              className="mr-3 w-5 h-5 accent-brand-primary"
            />
            I understand
          </label>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!understood}
            className={`px-6 py-3 rounded-medium font-bold border-2 transition ${
              understood
                ? 'bg-brand-accent text-brand-primary border-brand-primary hover:opacity-90'
                : 'bg-border-light text-text-dark border-border-light opacity-60 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default IntroductionScreen;
