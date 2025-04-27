// src/components/OnboardingSequence.jsx
import React, { useEffect, useState } from "react";
import capystand from "../assets/capystand.png";
import capystop from "../assets/capystop.png";
import capyicon from "../assets/capyicon.png";
import interfaceinst from "../assets/interfaceinst.png";
import capyiconrev from "../assets/capyiconrev.png";
import bground from "../assets/bground.png"

function OnboardingSequence({ onDone, onReturn, condition }) {
  const isAvatar = condition?.avatar;

  const messageSets = [
    {
      title: isAvatar ? "What is Kagami?" : "What is KagamiMart?",
      avatar: isAvatar ? capystand : null,
      bubbles: isAvatar
        ? [
            "Hi there, I’m Kagami.",
            "I am an intelligent shopping assistant that asks about your preferences and helps you discover items that best match what’s important to you—like ratings, reviews, colors, or size.",
          ]
        : [
            "KagamiMart is an intelligent shopping assistant that asks about your preferences and helps you discover items that best match what’s important to you—like ratings, reviews, colors, or size.",
          ],
    },
    {
      title: isAvatar ? "What is Kagami?" : "What is KagamiMart?",
      avatar: isAvatar ? capystand : null,
      bubbles: isAvatar
        ? [
            "Using the chat box, just tell me what matters to you.",
            'For example, if you’re looking for a pair of shoes, you might say something like: “I want blue running shoes for a marathon, size 11!”',
            "I’ll ask a few questions if I need to, then do my best to find something that fits your needs.",
          ]
        : [
            "Feel free to specify what matters to you.",
            'For example, if you’re looking for a pair of shoes, you might say something like: “I want blue running shoes for a marathon, size 11!”',
            "If elaboration is needed, additional questions will be provided in the chat.",
          ],
    },
    {
      title: isAvatar ? "Before we begin..." : "Before you begin",
      avatar: isAvatar ? capystop : null,
      bubbles: [
        "As a reminder, this experience is part of a research study on shopping assistants. Your interaction may be different from others’, and responses are generated based on system design choices.",
      ],
      checkbox: true,
    },
  ];

  const [step, setStep] = useState(0);
  const [visibleBubbles, setVisibleBubbles] = useState([]);
  const [isChecked, setIsChecked] = useState(false);

  const [showContent, setShowContent] = useState(false);

useEffect(() => {
  setShowContent(false);
  setVisibleBubbles([]);
  setIsChecked(false);

  const delayStart = step === 1 ? 200 : 0;
  const bubbleInterval = 600;
  const timeouts = [];

  const init = setTimeout(() => {
    setShowContent(true);
    messageSets[step].bubbles.forEach((_, i) => {
      timeouts.push(
        setTimeout(() => {
          setVisibleBubbles((prev) => [...prev, i]);
        }, bubbleInterval * i)
      );
    });
  }, delayStart);

  return () => {
    clearTimeout(init);
    timeouts.forEach(clearTimeout);
  };
}, [step]);

  const handleNext = () => {
    if (step < messageSets.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      onDone();
    }
  };

  const { title, avatar, bubbles, checkbox } = messageSets[step];

  return (
    <div
      className="w-screen h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${!isAvatar ? bground : bground})` }}
    >
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-md rounded-[40px] shadow-xl px-8 py-10 text-left max-w-2xl w-full mx-4 relative">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">{title}</h2>

          {step === 1 ? (
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
              {isAvatar && (
                <div className="w-full sm:w-[220px] flex-shrink-0">
                  <img
                    src={interfaceinst}
                    alt="Chat instruction visual"
                    className="w-full h-auto rounded-xl shadow-md"
                  />
                </div>
              )}
              <div className="flex flex-col gap-4 flex-1">
              {showContent &&
                bubbles.map((text, i) => (
                  <div
                    key={i}
                    className={`transition-opacity duration-500 ${
                      visibleBubbles.includes(i) ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <div className="bg-gray-300 rounded-2xl px-4 py-3 text-gray-800 shadow-inner max-w-md">
                      {text}
                    </div>
                  </div>
                ))}
              </div>
              {isAvatar && (
                <div className="flex flex-col justify-end">
                  <img src={avatar} alt="Capy" className="w-[60px] sm:w-[80px] mt-2 self-end" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-end justify-between mb-8 gap-6">
              <div className="flex flex-col gap-4 flex-1">
              {showContent &&
                bubbles.map((text, i) => (
                  <div
                    key={i}
                    className={`transition-opacity duration-500 ${
                      visibleBubbles.includes(i) ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <div className="bg-gray-300 rounded-2xl px-4 py-3 text-gray-800 shadow-inner">
                      {text}
                    </div>
                  </div>
                ))}
              </div>
              {isAvatar && (
                <img src={avatar} alt="Capy" className="w-[60px] sm:w-[80px] mt-2 self-end" />
              )}
            </div>
          )}

          {checkbox && (
            <div className="flex items-center gap-2 bg-gray-300 rounded-full px-4 py-2 mb-4">
              <input
                id="agree"
                type="checkbox"
                className="w-4 h-4"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
              />
              <label htmlFor="agree" className="text-sm text-gray-700">
                I understand this is part of a research study.
              </label>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-[15px] py-[5px] bg-[#ececec] rounded-[40px] outline outline-1 outline-offset-[-1px] outline-[#c4c4c4] inline-flex justify-center items-center gap-2.5 hover:bg-[#e0e0e0] active:scale-[0.98] transition-all duration-150"
              >
                {isAvatar && (
                  <img src={capyiconrev} alt="Back" className="w-[33px] h-[33px]" />
                )}
                <div className="text-[#1f1f1f] text-lg font-normal leading-[18px]">Return</div>
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleNext}
              disabled={checkbox && !isChecked}
              className={`px-[15px] py-[5px] rounded-[40px] outline outline-1 outline-offset-[-1px] inline-flex justify-center items-center gap-2.5 transition-all duration-150 ${
                checkbox && !isChecked
                  ? "bg-gray-300 outline-gray-300 cursor-not-allowed"
                  : "bg-[#ececec] outline-[#c4c4c4] hover:bg-[#e0e0e0] active:scale-[0.98]"
              }`}
            >
              {isAvatar && (
                <img src={capyicon} alt="Next" className="w-[33px] h-[33px]" />
              )}
              <div className="text-[#1f1f1f] text-lg font-normal leading-[18px]">Continue</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingSequence;
