import React, { useState, useEffect } from 'react';
import backgroundChat from '../assets/background_chat.png';
import frog from '../assets/avatars/frog.png';
import panda from '../assets/avatars/panda.png';
import cat from '../assets/avatars/cat.png';
import capybara from '../assets/avatars/capybara.png';
import bird from '../assets/avatars/bird.png';
import elephant from '../assets/avatars/elephant.png';
import arrowImg from '../assets/arrow.png';



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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(null); // 'left', 'right', or null
  const [animationKey, setAnimationKey] = useState(0); // To force re-render/re-mount
  const [isBouncing, setIsBouncing] = useState(true); // Control bounce animation

  // Effect to re-enable bouncing after the slide animation completes
  useEffect(() => {
    // Only run this logic if a slide animation was triggered (key > 0)
    if (animationKey > 0) {
      // Disable bouncing immediately when the key changes (it was set to false in handlers)
      // Set a timer to re-enable bouncing after the slide duration
      const timer = setTimeout(() => {
        setIsBouncing(true);
        setSlideDirection(null); // Reset slide direction after animation finishes
      }, SLIDE_ANIMATION_DURATION_MS);

      // Cleanup function to clear the timer if the component unmounts
      // or if the key changes again before the timer fires
      return () => clearTimeout(timer);
    }
     // Note: No dependency array change needed here, it correctly depends on animationKey
  }, [animationKey]); // Re-run when animationKey changes

  const handleNext = () => {
    setIsBouncing(false); // Stop bouncing
    setSlideDirection('right'); // Set slide direction
    setAnimationKey((prevKey) => prevKey + 1); // Trigger remount/slide animation
    // It's often slightly better to update the index *after* state changes
    // that affect the *new* element's rendering, though React batches updates.
    setCurrentIndex((prev) => (prev + 1) % avatars.length);
  };

  const handlePrev = () => {
    setIsBouncing(false); // Stop bouncing
    setSlideDirection('left'); // Set slide direction
    setAnimationKey((prevKey) => prevKey + 1); // Trigger remount/slide animation
    setCurrentIndex((prev) => (prev - 1 + avatars.length) % avatars.length);
  };

  const handleConfirm = () => {
    const selectedAvatar = avatars[currentIndex];
    onNext(selectedAvatar.imgsrc); // Pass the IMAGE URL, not an object or id
  };

  // Determine the classes dynamically
  const getAvatarClasses = () => {
    let classes = 'w-96 h-auto object-contain';
    if (isBouncing) {
      classes += ' animate-bounceSlow'; // Add bounce if state is true
    } else if (slideDirection === 'left') {
      classes += ' animate-slideLeftSmall'; // Add slide left if applicable (and not bouncing)
    } else if (slideDirection === 'right') {
      classes += ' animate-slideRightSmall'; // Add slide right if applicable (and not bouncing)
    }
    // If !isBouncing and slideDirection is null (during the brief moment before timeout finishes),
    // no animation class might be applied, which is fine.
    return classes;
  };


  return (
    <div
      className="w-screen h-screen bg-cover bg-center flex flex-col items-center justify-between relative"
      style={{ backgroundImage: `url(${backgroundChat})` }}
    >
      {/* Top Text */}
      <div className="mt-8 text-center text-2xl font-semibold bg-gray-700 text-white px-6 py-2 rounded-full">
        Select your avatar!
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Arrows and Avatar */}
      <div className="flex items-end justify-center gap-10 mb-0">
          <button onClick={handlePrev} aria-label="Previous Avatar">
        <img
          src={arrowImg}
          alt="Previous"
          className="w-10 h-10 transform hover:scale-110 transition relative -top-40"
        />
        </button>

        <img
          key={animationKey} // Force remount using the key
          src={avatars[currentIndex].imgsrc}
          alt={avatars[currentIndex].label}
          className={getAvatarClasses()} // Apply classes based on state
          // No onAnimationEnd needed here, timing is handled by useEffect/setTimeout
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
      <div className="mb-10">
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

