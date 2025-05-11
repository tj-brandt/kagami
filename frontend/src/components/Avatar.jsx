import React, { useState, useEffect, useRef } from 'react'; // Added useRef
// import backgroundChat from '../assets/background_chat.png'; // Vanta will be the background
import frog from '../assets/avatars/frog.png';
import panda from '../assets/avatars/panda.png';
import cat from '../assets/avatars/cat.png';
import capybara from '../assets/avatars/capybara.png';
import bird from '../assets/avatars/bird.png';
import elephant from '../assets/avatars/elephant.png';
import arrowImg from '../assets/arrow.png';
import * as THREE from 'three'; // For Vanta
import FOG from 'vanta/dist/vanta.fog.min.js';

const avatars = [
  { id: 'frog', label: 'Frog', imgsrc: frog },
  { id: 'panda', label: 'Panda', imgsrc: panda },
  { id: 'cat', label: 'Cat', imgsrc: cat },
  { id: 'elephant', label: 'Elephant', imgsrc: elephant },
  { id: 'capybara', label: 'Capybara', imgsrc: capybara },
  { id: 'bird', label: 'Bird', imgsrc: bird },
];

// Define duration in ms to match Tailwind config (0.4s)
const SLIDE_ANIMATION_DURATION_MS = 400;

export default function AvatarSelection({ onNext }) {
  const vantaRef = useRef(null); // Ref for Vanta
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(null); // 'left', 'right', or null
  const [animationKey, setAnimationKey] = useState(0); // To force re-render/re-mount
  const [isBouncing, setIsBouncing] = useState(true); // Control bounce animation

  // Vanta.js Background Effect
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
        baseColor: 0xffffff, // Consistent base color
        blurFactor: 0.58,
        speed: 0.10
      });
    }

    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  // Effect to re-enable bouncing after the slide animation completes
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

  const getAvatarClasses = () => {
    let classes = 'w-96 h-auto object-contain';
    if (isBouncing) {
      classes += ' animate-bounceSlow'; 
    } else if (slideDirection === 'left') {
      classes += ' animate-slideLeftSmall'; 
    } else if (slideDirection === 'right') {
      classes += ' animate-slideRightSmall'; 
    }
    return classes;
  };


  return (
    <div
      ref={vantaRef} // Apply vantaRef here
      id="vanta-bg"   // Optional: if you have CSS targeting this
      className="w-screen h-screen flex flex-col items-center justify-between relative" // Removed bg-cover, bg-center
      style={{
        // backgroundImage: `url(${backgroundChat})`, // Removed: Vanta will be the background
        overflow: 'hidden' // Good practice for Vanta containers
      }}
    >
      {/* Top Text */}
      <div className="mt-8 text-center text-2xl font-semibold bg-gray-700 text-white px-6 py-2 rounded-full z-10"> {/* Added z-10 */}
        Select your avatar!
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Arrows and Avatar */}
      <div className="flex items-end justify-center gap-10 mb-0 z-10"> {/* Added z-10 */}
          <button onClick={handlePrev} aria-label="Previous Avatar">
        <img
          src={arrowImg}
          alt="Previous"
          className="w-10 h-10 transform hover:scale-110 transition relative -top-40"
        />
        </button>

        <img
          key={animationKey} 
          src={avatars[currentIndex].imgsrc}
          alt={avatars[currentIndex].label}
          className={getAvatarClasses()} 
        />

        <button onClick={handleNext} aria-label="Next Avatar">
          <img
            src={arrowImg}
            alt="Next"
            className="w-10 h-10 hover:scale-110 rotate-180 transition relative -top-40"
          />
        </button>
      </div>

      {/* Confirm Button */}
      <div className="mb-10 z-10"> {/* Added z-10 */}
        <button
          onClick={handleConfirm}
          className="bg-white text-gray-600 px-6 py-3 rounded-full hover:bg-gray-300 transition"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}