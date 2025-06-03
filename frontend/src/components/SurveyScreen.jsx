import React, { useEffect } from 'react';

function SurveyScreen() {
  // You might want to log a frontend event here
  useEffect(() => {
    // logFrontendEvent('survey_screen_viewed'); // Need to pass logFrontendEvent if used
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-bg-light dark:bg-dark-bg text-brand-primary dark:text-dark-text transition-colors duration-500 animate-fadeIn">
      <div className="bg-bg-surface-light dark:bg-dark-surface p-8 rounded-large border-div-md border-brand-primary dark:border-dark-border shadow-xl text-center max-w-sm w-4/5">
        <h2 className="text-2xl font-bold mb-4">Experiment Complete</h2>
        <p className="mb-4 text-brand-primary dark:text-dark-text">Thank you for your participation!</p>
        <p className="mb-6 text-brand-primary dark:text-dark-text">Please click the link below to proceed to the final survey:</p>
        <a
          href="YOUR_SURVEY_URL_HERE" // REMINDER: Update this URL!
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 px-6 py-3 bg-brand-primary text-bg-light dark:bg-dark-text dark:text-dark-bg font-semibold rounded-large shadow hover:bg-brand-secondary hover:text-brand-primary dark:hover:bg-dark-surface dark:hover:text-dark-text transition duration-200 border-button border-brand-primary dark:border-dark-text"
        >
          Open Survey
        </a>
      </div>
    </div>
  );
}

export default SurveyScreen;