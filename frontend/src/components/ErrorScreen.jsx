import React, { useEffect } from 'react';

function ErrorScreen() {
  // You might want to log a frontend event here as well
  useEffect(() => {
    // logFrontendEvent('error_screen_viewed'); // Need to pass logFrontendEvent if used
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-bg-light dark:bg-dark-bg text-brand-primary dark:text-dark-text transition-colors duration-500 animate-fadeIn">
      <div className="bg-bg-surface-light dark:bg-dark-surface p-8 rounded-large border-div-md border-brand-primary dark:border-dark-border shadow-xl text-center max-w-sm w-4/5">
        <h2 className="text-2xl font-bold mb-4 text-brand-primary dark:text-dark-text">Error</h2>
        <p className="mb-4 text-red-600 dark:text-red-400">Failed to start the session or invalid parameters provided (pid/cond).</p>
        <p className="text-brand-primary dark:text-dark-text">Please check the link or contact the administrator.</p>
      </div>
    </div>
  );
}

export default ErrorScreen;