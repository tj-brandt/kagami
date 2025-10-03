// src/components/SurveyScreen.jsx
import React from 'react';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/solid';

function SurveyScreen({ qualtricsReturnUrl }) {

  return (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
      <ArrowUturnLeftIcon className="h-16 w-16 text-primary mb-6" />

      <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-foreground mb-4">
        Chat Complete!
      </h1>

      <p className="text-lg sm:text-xl text-foreground/80 mb-8">
        Thank you for your participation. Please click the button below to complete the final survey questions.
      </p>

      {qualtricsReturnUrl ? (
        <a
          href={qualtricsReturnUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center mt-4 px-8 py-3 rounded-lg font-semibold text-base bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue to Final Survey
        </a>
      ) : (
        <div className="mt-4 p-4 border-l-4 border-yellow-500 bg-yellow-500/10">
          <p className="text-foreground/90">
            Please return to the original survey tab to finish the study.
          </p>
        </div>
      )}
    </div>
  );
}

export default SurveyScreen;