// src/components/PremadeAvatarGallery.jsx
import React, { useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';

function PremadeAvatarGallery({ premadeAvatars, onSelect, logFrontendEvent }) {
  const avatarList = Object.values(premadeAvatars);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % avatarList.length);
    logFrontendEvent('premade_avatar_browse_next');
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + avatarList.length) % avatarList.length);
    logFrontendEvent('premade_avatar_browse_prev');
  };

  const handleSelect = () => {
    const selectedUrl = avatarList[currentIndex];
    onSelect(selectedUrl);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="flex items-center justify-center gap-2 sm:gap-4 w-full mb-8">
        
        {/* Arrow Button: Left */}
        <button
          onClick={handlePrev}
          aria-label="Previous avatar"
          className="p-3 rounded-full text-foreground/60 hover:bg-card hover:text-foreground/80 transition-colors"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>

        <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-2xl bg-card border border-border p-2 flex-shrink-0">
          <img
            src={avatarList[currentIndex]}
            alt="Selected Avatar"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Arrow Button: Right */}
        <button
          onClick={handleNext}
          aria-label="Next avatar"
          className="p-3 rounded-full text-foreground/60 hover:bg-card hover:text-foreground/80 transition-colors"
        >
          <ArrowRightIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Select Button: */}
      <button
        onClick={handleSelect}
        className="w-full max-w-xs px-8 py-3 rounded-lg font-semibold text-base
                   bg-primary text-primary-foreground
                   hover:bg-primary/90
                   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/80
                   transition-all"
      >
        Select
      </button>
    </div>
  );
}

export default PremadeAvatarGallery;