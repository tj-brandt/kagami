import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import SplitType from "split-type";

const introTexts = [
  "Welcome to Kagami Chat!",
  "Just a heads up: this is a friendly chat with Kagami, your virtual chat companion.",
  "Kagami will do their best to match your vibe and make you feel at home. This isn’t real advice or a real service — it’s just for fun and to help us learn how people experience AI conversations.",
  <>
    Everything you say stays <strong className="font-semibold">private</strong> and will only be used for research in a <strong className="font-semibold">safe, confidential</strong> way.
  </>,
  "You can leave whenever you like.",
  "You will have 10 minutes to chat before the session ends automatically."
];

export default function Intro({ onContinue }) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [textAnimationComplete, setTextAnimationComplete] = useState(false);
  const textRefs = useRef([]);

  useEffect(() => {
    const splitInstances = textRefs.current.map((el) =>
      new SplitType(el, { types: "lines, words, chars", tagName: "span" })
    );

    
    gsap.from("[data-animate] .word", {
      opacity: 0.3,
      y: 0,
      duration: 0.2,
      ease: "second.inOut",
      stagger: 0.1,
      onComplete: () => setTextAnimationComplete(true),
    });

    return () => {
      splitInstances.forEach((split) => split.revert());
    };
  }, []);

  return (
    <div className="h-screen flex flex-col justify-between items-center px-4 pt-24 sm:pt-32 pb-6 overflow-hidden">
      {/* Text Area */}
      <div className="w-full max-w-lg text-left text-black space-y-3 sm:space-y-4">
        {introTexts.map((text, index) => (
          <p
            key={index}
            data-animate
            ref={(el) => (textRefs.current[index] = el)}
            className="text-base sm:text-lg leading-snug sm:leading-relaxed"
          >
            {text}
          </p>
        ))}
      </div>

      {/* Mobile Footer */}
      <div
        className={`fixed bottom-6 w-full px-6 flex flex-col items-center sm:hidden z-30 transition-opacity duration-500 ease-in ${
          textAnimationComplete ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center space-x-2 mb-4 bg-white/60 backdrop-blur-sm p-3 rounded-lg shadow">
          <label htmlFor="consent" className="text-sm text-black cursor-pointer select-none">
            I understand.
          </label>
          <input
            type="checkbox"
            id="consent"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="form-checkbox h-5 w-5 text-blue-600 bg-white border-gray-400 rounded focus:ring-blue-500 cursor-pointer"
          />
        </div>
        <button
          onClick={() => consentGiven && onContinue()}
          disabled={!consentGiven}
          className={`px-6 py-3 rounded-full font-semibold transition-all duration-150
            bg-black text-white hover:bg-gray-800 active:scale-95 shadow-lg
            ${!consentGiven ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Continue
        </button>
      </div>

      {/* Desktop Footer */}
      {textAnimationComplete && (
        <div className="hidden sm:flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 mt-12">
          <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm p-3 rounded-lg shadow">
            <label htmlFor="consent-desktop" className="text-sm md:text-base text-black cursor-pointer select-none">
              I understand.
            </label>
            <input
              type="checkbox"
              id="consent-desktop"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="form-checkbox h-5 w-5 text-blue-600 bg-white border-gray-400 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
          <button
            onClick={() => consentGiven && onContinue()}
            disabled={!consentGiven}
            className={`px-6 py-3 rounded-full font-semibold transition-all duration-150
              bg-black text-white hover:bg-gray-800 active:scale-95 shadow-lg
              ${!consentGiven ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
