import React, { useState } from 'react';
import arrow from '../assets/arrow.png'; // Assuming you have this asset

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
    logFrontendEvent('premade_avatar_selected_click', { avatar_url: selectedUrl });
    onSelect(selectedUrl);
  };

    return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Centered Avatar + Arrows */}
      <div className="relative w-full flex justify-center items-center mb-6 overflow-visible">
        {/* Arrow: Left */}
        <button
          onClick={handlePrev}
          aria-label="Previous avatar"
          className="absolute left-[calc(50%-190px)] top-1/2 transform -translate-y-1/2 
                    bg-brand-primary text-brand-primary border-4 border-brand-secondary 
                    rounded-[20px] w-12 h-12 flex items-center justify-center 
                    shadow-md hover:scale-105 transition z-10"
        >
          <img src={arrow} alt="Previous" className="w-5 h-5 rotate-180" />
        </button>

        {/* Avatar Frame */}
        <div className="w-[320px] aspect-square rounded-[30px] overflow-hidden
                        border-[10px] border-brand-primary dark:border-[#997D8A]
                        bg-[#997D8A] dark:bg-bg-surface-light flex items-center justify-center">
          <img
            src={avatarList[currentIndex]}
            alt="Selected Avatar"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Arrow: Right */}
        <button
          onClick={handleNext}
          aria-label="Next avatar"
          className="absolute right-[calc(50%-190px)] top-1/2 transform -translate-y-1/2 
                    bg-brand-primary text-brand-primary border-4 border-brand-secondary 
                    rounded-[20px] w-12 h-12 flex items-center justify-center 
                    shadow-md hover:scale-105 transition z-10"
        >
          <img src={arrow} alt="Next" className="w-5 h-5" />
        </button>
      </div>

      {/* Select Button */}
      <button
        onClick={handleSelect}
        className="px-10 py-3 rounded-[30px] font-bold text-lg 
                  bg-brand-accent text-brand-primary 
                  border-2 border-brand-primary shadow-sm 
                  hover:opacity-90 transition"
      >
        Select
      </button>
    </div>
  );
}

export default PremadeAvatarGallery;
