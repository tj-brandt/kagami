import React from 'react';
import kagamiLogoLight from '../assets/kagami.png';
import kagamiLogoDark from '../assets/kagamid.png';

export default function LoadingScreen({ loadingProgress, darkMode }) {
  const logoSrc = darkMode ? kagamiLogoDark : kagamiLogoLight;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-bg-surface-light dark:bg-dark-bg text-brand-primary dark:text-dark-text px-4">
      
      {/* Logo */}
      <div className="w-full max-w-[28rem] md:max-w-[40rem] mb-8">
        <img src={logoSrc} alt="Kagami Logo" className="w-full h-auto object-contain" />
      </div>

      {/* Label */}
      <p className="text-lg font-bold text-brand-primary dark:text-dark-text">Loading ... !</p>

      {/* Progress Bar */}
      <div className="w-full max-w-md mt-4">
        <div className="w-full h-4 bg-brand-primary rounded-full border-div-sm border-brand-primary">
          <div
            className="h-full bg-brand-accent rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
        <p className="text-sm mt-2 text-center text-brand-primary dark:text-dark-text">{loadingProgress}%</p>
      </div>
    </div>
  );
}
