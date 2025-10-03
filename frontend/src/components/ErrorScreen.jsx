// src/components/ErrorScreen.jsx
import React, { useEffect } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

function ErrorScreen({ logFrontendEvent }) { 
  useEffect(() => {
    if (logFrontendEvent) {
      logFrontendEvent('error_screen_viewed');
    }
  }, [logFrontendEvent]); 

  return (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
        
        <ExclamationTriangleIcon className="h-16 w-16 text-red-500/80 mb-6" />

        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-foreground mb-2">
            Oops! An Error Occurred
        </h1>
        
        <h2 className="text-xl sm:text-2xl text-red-600 dark:text-red-400 mb-8">
            Something didn't load correctly.
        </h2>

        <div className="space-y-4 text-base sm:text-lg text-foreground/80 leading-relaxed">
            <p>
                This can happen if the experiment link was incomplete or modified. Please try using the original link from the study platform (e.g., Prolific) again.
            </p>
            <p className="font-medium text-foreground">
                If the problem continues, please return the study and contact the researcher. We apologize for the inconvenience.
            </p>
        </div>
    </div>
  );
}

export default ErrorScreen;