import React, { useState, useEffect } from "react";
import useTypewriter from '../hooks/useTypewriter'; // Assuming path is correct
// No need to import bgImage or kagamiLogo here anymore, App.jsx handles them

// Define the text chunks for the typewriter
const introTexts = [
  "Welcome to Kagami Chat! ",
  "Just a heads up: this is a friendly chat with Kagami, your virtual chat companion.",
  "Kagami will do their best to match your vibe and make you feel at home. This isn’t real advice or a real service — it’s just for fun and to help us learn how people experience AI conversations.",
  "Everything you say stays private and will only be used for research in a safe, confidential way.",
  "You can leave whenever you like.",
  "You will have 10 minutes to chat before the session ends automatically."
];

// Helper function to apply bolding after typing (Example)
const applyBolding = (text, index) => {
    if (index === 2) { // Apply only to the third paragraph
        return text
            .replace('private', '<strong class="font-semibold">private</strong>')
            .replace('safe, confidential', '<strong class="font-semibold">safe, confidential</strong>');
    }
    return text;
};


const Intro = ({ onContinue, condition /*, isVisible (optional prop from App) */ }) => {
  const [consentGiven, setConsentGiven] = useState(false);
  const { displayedTexts, isComplete: textAnimationComplete } = useTypewriter(introTexts, {
      charInterval: 10,
      chunkDelay: 400,
      initialDelay: 800 // Slightly longer delay to ensure App bg transition is done
  });

  // Debugging log
  // useEffect(() => {
  //   console.log("Text Animation Complete:", textAnimationComplete);
  // }, [textAnimationComplete]);
  // useEffect(() => {
  //   console.log("Consent Given:", consentGiven);
  // }, [consentGiven]);


  const handleContinue = () => {
    if (!consentGiven) return;
    onContinue();
  };

  return (
    // This container holds ONLY the intro-specific content
    // It fades in as a whole after App.jsx signals readiness (implicitly via phase change)
    <div className="min-h-screen flex flex-col items-center pt-24 sm:pt-32 px-4 pb-20">

        {/* Text Content Area */}
        <div className="w-full md:max-w-[calc(100vw-40vw)] md:mx-auto text-left text-black space-y-4 mt-12 sm:mt-0 sm:px-4">
        {/* Render displayed text paragraphs */}
            {introTexts.map((_, index) => ( // Map over original texts to ensure all paragraphs render containers
                 <p key={index} className="text-2xl sm:text-xl leading-relaxed" style={{ minHeight: '1.5em' }}>
                    {/* Render the text from the hook for the current index */}
                    {/* Apply formatting using dangerouslySetInnerHTML AFTER typing */}
                    <span dangerouslySetInnerHTML={{ __html: applyBolding(displayedTexts[index] || '', index) }} />

                    {/* --- Removed the index === 2 conditional bypass --- */}
                </p>
            ))}
        </div>

                      {/* Mobile-only footer (fixed at bottom) */}
              <div className={`
                fixed bottom-6 w-full px-6 flex flex-col items-center sm:hidden z-30
                transition-opacity duration-500 ease-in
                ${textAnimationComplete ? 'opacity-100' : 'opacity-0 pointer-events-none'}
              `}>
                <div className="flex items-center space-x-2 mb-4 bg-white/60 backdrop-blur-sm p-3 rounded-lg shadow">
                  <label htmlFor="consent" className="text-sm text-black cursor-pointer select-none">
                    I understand.
                  </label>
                  <input
                    type="checkbox"
                    id="consent"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="form-checkbox h-5 w-5 text-blue-600 bg-white border-gray-400 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <button
                  onClick={handleContinue}
                  disabled={!consentGiven}
                  className={`px-6 py-3 rounded-full font-semibold transition-all duration-150
                              bg-black text-white hover:bg-gray-800 active:scale-95 shadow-lg
                              ${!consentGiven ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Continue
                </button>
              </div>

              {/* Desktop-only inline consent + button (visible only on md+) */}
              { textAnimationComplete && (
                <div className="hidden sm:flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 mt-12">
                  <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm p-3 rounded-lg shadow">
                    <label htmlFor="consent-desktop" className="text-sm md:text-base text-black cursor-pointer select-none">
                      I understand.
                    </label>
                    <input
                      type="checkbox"
                      id="consent-desktop"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-blue-600 bg-white border-gray-400 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={handleContinue}
                    disabled={!consentGiven}
                    className={`px-6 py-3 rounded-full font-semibold transition-all duration-150
                                bg-black text-white hover:bg-gray-800 active:scale-95 shadow-lg
                                ${!consentGiven ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Continue
                  </button>
                </div>
              )}

            {/* )} */}
        </div>

// End Intro content container
  );
};

export default Intro;