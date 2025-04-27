// src/components/Intro.jsx
import React from "react";
import bground from "../assets/bground.png";
import kagamimartlogo from "../assets/kagamimartlogo.png";
import capyicon from "../assets/capyicon.png";

const Intro = ({ onContinue, condition }) => {
  const isAvatar = condition?.avatar;

  return (
    <div
      className="w-screen h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${isAvatar ? bground : bground})` }}
    >
      {/* For avatar condition, yellow logo box replaces the white card entirely */}
      {isAvatar ? (
        <div className="bg-[#FFF7D6] border-[4px] border-[#F4D75B] rounded-[40px] px-8 py-6 shadow-xl text-center flex flex-col items-center animate-fadeIn">
          <img src={kagamimartlogo} alt="Kagami Mart Logo" className="w-80 sm:w-96 mx-auto mb-4" />
          <button
            onClick={onContinue}
            className="px-[15px] py-[5px] bg-[#ececec] rounded-[40px] outline outline-1 outline-offset-[-1px] outline-[#c4c4c4] inline-flex justify-center items-center gap-2.5 hover:bg-[#e0e0e0] active:scale-[0.98] transition-all duration-150"
          >
            {isAvatar && <img src={capyicon} alt="Capy Icon" className="w-[33px] h-[33px]" />}
            <div className="text-[#1f1f1f] text-lg font-normal leading-[18px]">Continue</div>
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-b from-sky-50 to-white rounded-[30px] shadow-xl flex flex-col items-center justify-center text-center px-20 py-10 max-w-md">
          <h1 className="text-xl sm:text-3xl font-regular text-gray-800 mb-2">Welcome to</h1>
          <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-8">KagamiMart</h2>
          <button
            onClick={onContinue}
            className="px-[15px] py-[5px] bg-[#ececec] rounded-[40px] outline outline-1 outline-offset-[-1px] outline-[#c4c4c4] inline-flex justify-center items-center gap-2.5 hover:bg-[#e0e0e0] active:scale-[0.98] transition-all duration-150"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default Intro;
