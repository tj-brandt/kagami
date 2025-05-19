import React, { useState, useEffect, useRef } from 'react';
import frog from '../assets/avatars/frog.png';
import panda from '../assets/avatars/panda.png';
import cat from '../assets/avatars/cat.png';
import capybara from '../assets/avatars/capybara.png';
import bird from '../assets/avatars/bird.png';
import elephant from '../assets/avatars/elephant.png';
import arrowImg from '../assets/arrow.png';
import * as THREE from 'three';
import FOG from 'vanta/dist/vanta.fog.min.js';

const avatars = [
  { id: 'frog', label: 'Frog', imgsrc: frog },
  { id: 'panda', label: 'Panda', imgsrc: panda },
  { id: 'cat', label: 'Cat', imgsrc: cat },
  { id: 'elephant', label: 'Elephant', imgsrc: elephant },
  { id: 'capybara', label: 'Capybara', imgsrc: capybara },
  { id: 'bird', label: 'Bird', imgsrc: bird },
];

const SLIDE_ANIMATION_DURATION_MS = 400;

export default function AvatarSelection({ onNext }) {
  const vantaRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [isBouncing, setIsBouncing] = useState(true);

  useEffect(() => {
    let vantaEffect = null;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && vantaRef.current) {
      vantaEffect = FOG({
        el: vantaRef.current,
        THREE: THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        highlightColor: 0xffffff,
        midtoneColor: 0xe1e1e1,
        lowlightColor: 0xc5c5c5,
        baseColor: 0xffffff,
        blurFactor: 0.58,
        speed: 0.10
      });
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, []);

  useEffect(() => {
    if (animationKey > 0) {
      const timer = setTimeout(() => {
        setIsBouncing(true);
        setSlideDirection(null);
      }, SLIDE_ANIMATION_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [animationKey]);

  const handleNext = () => {
    setIsBouncing(false);
    setSlideDirection('right');
    setAnimationKey((prevKey) => prevKey + 1);
    setCurrentIndex((prev) => (prev + 1) % avatars.length);
  };

  const handlePrev = () => {
    setIsBouncing(false);
    setSlideDirection('left');
    setAnimationKey((prevKey) => prevKey + 1);
    setCurrentIndex((prev) => (prev - 1 + avatars.length) % avatars.length);
  };

  const handleConfirm = () => {
    const selectedAvatar = avatars[currentIndex];
    onNext(selectedAvatar.imgsrc);
  };

  const getAvatarAnimationClasses = () => {
    if (isBouncing) return 'animate-bounceSlow';
    if (slideDirection === 'left') return 'animate-slideLeftSmall';
    if (slideDirection === 'right') return 'animate-slideRightSmall';
    return '';
  };

  return (
    <div
      ref={vantaRef}
      id="vanta-bg"
      // MODIFIED: Removed justify-between, main container now centers its content vertically if space allows.
      className="w-screen h-screen flex flex-col items-center relative overflow-hidden pt-4 pb-4 sm:pt-6 sm:pb-6"
    >
      {/* Top Text */}
      <div className="text-center text-xl sm:text-2xl font-semibold bg-gray-700 bg-opacity-70 text-white px-4 py-2 sm:px-6 rounded-full z-10">
        Select your avatar!
      </div>

      {/* Middle Section: Avatar, Arrows, and Confirm Button - This will take up flexible space and center its content */}
      <div className="flex-grow w-full flex flex-col justify-center items-center px-4 z-10 overflow-hidden py-2">
        {/* Avatar and Arrows Container */}
        <div className="relative w-full max-w-[200px] xs:max-w-[220px] sm:max-w-[260px] md:max-w-xs flex justify-center items-center mb-4 sm:mb-6"> {/* Added margin-bottom here */}
          {/* Left Arrow */}
          <button
            onClick={handlePrev}
            aria-label="Previous Avatar"
            className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 p-2 z-20 rounded-full hover:bg-gray-500 hover:bg-opacity-20 transition-colors"
          >
            <img
              src={arrowImg}
              alt="Previous"
              className="w-6 h-5 xs:w-8 xs:h-6 sm:w-10 sm:h-8 hover:scale-110 transition-transform"
            />
          </button>

          {/* Avatar Image Container */}
          <div className="w-full aspect-square flex justify-center items-center">
            <img
              key={animationKey}
              src={avatars[currentIndex].imgsrc}
              alt={avatars[currentIndex].label}
              className={`max-w-full max-h-full object-contain ${getAvatarAnimationClasses()}`}
            />
          </div>

          {/* Right Arrow */}
          <button
            onClick={handleNext}
            aria-label="Next Avatar"
            className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 p-2 z-20 rounded-full hover:bg-gray-500 hover:bg-opacity-20 transition-colors"
          >
            <img
              src={arrowImg}
              alt="Next"
              className="w-6 h-5 xs:w-8 xs:h-6 sm:w-10 sm:h-8 rotate-180 hover:scale-110 transition-transform"
            />
          </button>
        </div>

        {/* Confirm Button - Now part of the middle, vertically centered group */}
        <div className="z-10"> {/* Removed mb from here, spacing handled by Avatar container's mb */}
          <button
            onClick={handleConfirm}
            className="bg-white text-gray-700 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full hover:bg-gray-200 active:bg-gray-300 transition-colors shadow-md text-sm sm:text-base font-medium"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}