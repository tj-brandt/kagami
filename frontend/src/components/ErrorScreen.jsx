import React, { useEffect } from 'react';
function ErrorScreen({ logFrontendEvent }) { // Added logFrontendEvent prop
  useEffect(() => {
    // Log frontend event when the error screen is viewed
    if (logFrontendEvent) {
      logFrontendEvent('error_screen_viewed');
    }
  }, [logFrontendEvent]); // Dependency array includes logFrontendEvent

  return (
    <div className="flex flex-col items-center h-full w-full p-4 bg-bg-surface-light dark:bg-dark-bg text-brand-primary dark:text-dark-text transition-colors duration-500">
      <div className="w-full max-w-lg px-4 leading-relaxed relative text-center"> 
        <h2 className="text-2xl font-bold mb-2">Oops! An Error Occurred.</h2> 
        <h3 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">Something didn't load quite right.</h3> 

        <p className="mb-2">It looks like there might be an issue with how you accessed the experiment.</p>
        <p className="mb-4">Please double-check the URL you were provided, or if you were given a specific link, try using that directly.</p>
        <p className="font-semibold">If the problem persists, please contact the experiment administrator for assistance.</p>
      </div>
    </div>
  );
}

export default ErrorScreen;