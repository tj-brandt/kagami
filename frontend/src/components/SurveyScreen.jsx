import React from 'react';
function SurveyScreen({ qualtricsReturnUrl }) {

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-bg-light dark:bg-dark-bg text-brand-primary dark:text-dark-text transition-colors duration-500 animate-fadeIn">
      <div className="bg-bg-surface-light dark:bg-dark-surface p-8 rounded-large border-div-md border-brand-primary dark:border-dark-border shadow-xl text-center max-w-md w-11/12 sm:w-4/5">
        <h2 className="text-2xl font-bold mb-4">Chat complete!</h2>
        <p className="mb-4 text-brand-primary dark:text-dark-text">
          Thank you for your participation.
        </p>
        <p className="mb-6 text-brand-primary dark:text-dark-text">
          You will be forwarded to the final survey.
        </p>

        {qualtricsReturnUrl ? (
          <>
            <p className="mb-6 text-brand-primary dark:text-dark-text">
              If you weren't automatically forwarded, please click the link below:
            </p>
            <a
              href={qualtricsReturnUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 px-6 py-3 bg-brand-primary text-bg-light dark:bg-dark-text dark:text-dark-bg font-semibold rounded-large shadow hover:bg-brand-secondary hover:text-brand-primary dark:hover:bg-dark-surface dark:hover:text-dark-text transition duration-200 border-button border-brand-primary dark:border-dark-text"
            >
              Open Final Survey
            </a>
          </>
        ) : (
          <>
            <p className="mb-2 text-brand-primary dark:text-dark-text">
              It seems we couldn't automatically redirect you, and a specific survey link was not available.
            </p>
            <p className="mt-4 text-brand-primary dark:text-dark-text">
              Please return to the Qualtrics tab or window you used for the initial survey to continue,
              or use the link provided by the research team.
            </p>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              If you continue to have issues, please contact the research coordinator.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default SurveyScreen;