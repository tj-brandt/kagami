// src/components/SurveyScreen.jsx
import React from 'react';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/solid';

function SurveyScreen() {

  return (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
            <ArrowUturnLeftIcon className="h-16 w-16 text-primary mb-6" />

      <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-foreground mb-4">
        Chat Complete!
      </h1>

      <p className="text-lg sm:text-xl text-foreground/80 mb-8">
        Thank you. You may now close this tab and return to the original Qualtrics survey tab to complete the final questions.
      </p>

      <div className="mt-4 p-4 border-l-4 border-accent bg-accent/10">
        <p className="text-foreground/90">
          The "Next" button in the survey will be enabled, allowing you to finish the study.
        </p>
      </div>
    </div>
  );
}

export default SurveyScreen;