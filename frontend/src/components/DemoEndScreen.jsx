// src/components/DemoEndScreen.jsx
import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

function DemoEndScreen() {
  const restartDemo = () => {
    window.location.href = '/demo';
  };

  return (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
      <CheckCircleIcon className="h-16 w-16 text-green-500 mb-6" />
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-foreground mb-4">
        Demo Complete!
      </h1>
      <p className="text-lg sm:text-xl text-foreground/80 mb-8">
        Thank you for trying out Kagami.
      </p>
      <button
        onClick={restartDemo}
        className="inline-flex items-center gap-2 mt-4 px-6 py-3
                   bg-primary text-primary-foreground
                   font-semibold rounded-lg shadow-sm
                   hover:bg-primary/90 transition-colors"
      >
        Run Demo Again
      </button>
    </div>
  );
}

export default DemoEndScreen;