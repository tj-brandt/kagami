// src/components/Ready.jsx
import React from "react";
import bground from "../assets/bground.png"; // or use another background if different

export default function Ready({ onNext, onReturn }) {
  return (
    <div
      className="w-screen h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${bground})` }}
    >
      <div className="bg-white/80 backdrop-blur-md rounded-[40px] shadow-xl px-10 py-8 max-w-xl text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Ready?</h1>
        <p className="text-gray-800 mb-2">
          You have <strong>5 minutes</strong> to use <strong>KagamiMart</strong>,
        </p>
        <p className="text-gray-700 mb-2">
          So please take this time to think of something you’ve shopped for recently — or something you’ve been meaning to look for.
        </p>
        <p className="text-gray-700 mb-6">
          If everything looks good, let’s begin!
        </p>

        <div className="flex justify-between items-center gap-4">
          <button
            onClick={onReturn}
            className="px-[15px] py-[5px] bg-[#ececec] rounded-[40px] outline outline-1 outline-offset-[-1px] outline-[#c4c4c4] inline-flex justify-center items-center text-[#1f1f1f] text-lg font-normal leading-[18px] hover:bg-[#e0e0e0] active:scale-[0.98] transition-all duration-150"
          >
            Return
          </button>
          <button
            onClick={onNext}
            className="px-[15px] py-[5px] bg-[#ececec] rounded-[40px] outline outline-1 outline-offset-[-1px] outline-[#c4c4c4] inline-flex justify-center items-center text-[#1f1f1f] text-lg font-normal leading-[18px] hover:bg-[#e0e0e0] active:scale-[0.98] transition-all duration-150"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
