import React, { useState } from "react";
import background from "../assets/background.png";      
import background_na from "../assets/background_na.png"; 

const Intro = ({ onContinue, condition }) => {
  const isAvatar = condition?.avatar;
  const [consentGiven, setConsentGiven] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleContinue = () => {
    setIsExiting(true);
    setTimeout(() => {
      onContinue(); // Call parent to change phase AFTER fade-out
    }, 300); // match your dissolve animation time (300ms)
  };

  return (
    <div
      className={`w-screen h-screen bg-cover bg-center flex items-center justify-center transition-opacity duration-300 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
      style={{
        backgroundImage: `url(${isAvatar ? background : background_na})`
      }}
    >
      <div className="bg-[#1f1f1f] border border-gray-500 rounded-[30px] p-8 max-w-lg w-full text-center text-gray-100 animate-fadeIn">
        <h1 className="text-3xl font-semibold mb-6">Before we begin...</h1>

        <div className="bg-[#444444] rounded-2xl p-6 mb-6 text-sm sm:text-base text-gray-200 leading-relaxed">
          <p className="mb-4">
            Just a heads up: this is a friendly chat with Kagami, your virtual café companion.
          </p>
          <p className="mb-4">
            Kagami will do their best to match your vibe and make you feel at home. This isn’t real advice or a real service — it’s just for fun and to help us learn how people experience AI conversations.
          </p>
          <p>
            Everything you say stays <strong>private</strong> and will only be used for research in a <strong>safe, confidential</strong> way. <strong>You can leave whenever you like.</strong>
          </p>
        </div>

        <div className="flex items-center justify-center mb-6 space-x-3">
          <input
            type="checkbox"
            id="consent"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="w-5 h-5 rounded focus:ring-0 focus:outline-none cursor-pointer"
          />
          <label htmlFor="consent" className="text-sm sm:text-base cursor-pointer">
            I understand this is part of a research study.
          </label>
        </div>

        <button
          onClick={handleContinue}
          disabled={!consentGiven}
          className={`px-6 py-3 rounded-full font-medium transition-all duration-150 ${
            consentGiven
              ? "bg-white text-gray-900 hover:bg-gray-200 active:scale-95"
              : "bg-gray-400 text-gray-600 cursor-not-allowed"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default Intro;
