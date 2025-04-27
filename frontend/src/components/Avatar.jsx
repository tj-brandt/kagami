// src/components/Avatar.jsx
import React, { useState } from 'react';
import axios from 'axios';
import bground from '../assets/bground.png';
import catImg from '../assets/cat.png';
import capyImg from '../assets/capy.png';
import pigImg from '../assets/pig.png';
import capyicon from '../assets/capyicon.png';

export default function Avatar({ onNext }) {
  const presets = [
    { id: 'cat', label: 'Cat', src: catImg },
    { id: 'capy', label: 'capy', src: capyImg },
    { id: 'pig', label: 'Pig', src: pigImg },
  ];

  const [selectedId, setSelectedId] = useState('capy');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customSrc, setCustomSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tempGeneratedUrl, setTempGeneratedUrl] = useState(null);
  // Optional: Add state for error messages
  // const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!customPrompt.trim()) return;
    setLoading(true);
    // setError(null); // Reset error on new attempt
    try {
      const res = await axios.post('http://localhost:8000/api/avatar/generate', {
        // Consider using process.env.REACT_APP_API_URL here
        prompt: customPrompt.trim(),
      });
      setTempGeneratedUrl(res.data.url);
      setShowModal(true);
    } catch (err) {
      console.error('Avatar generation failed:', err);
      // setError('Failed to generate image. Please try again.'); // User-friendly error
      alert('Failed to generate image.'); // Keep alert or replace with UI error
    } finally {
      setLoading(false);
    }
  };

    const handleConfirmAvatar = () => {
        setCustomSrc(tempGeneratedUrl);
        setSelectedId('custom');
        setShowModal(false);
        setTempGeneratedUrl(null); // Clear temp URL after confirmation
    };

    const handleCancelModal = () => {
        setShowModal(false);
        setTempGeneratedUrl(null);
    };

  const handleContinue = () => {
    // Find preset details ONLY if it's not custom
    const chosenPreset = selectedId !== 'custom' ? presets.find((p) => p.id === selectedId) : null;

    if (selectedId === 'custom' && customSrc) {
        // Pass custom avatar details and the prompt used
        onNext({ type: 'custom', src: customSrc, prompt: customPrompt }); // Pass prompt too
    } else if (chosenPreset) {
        // Pass preset details
        onNext({ type: chosenPreset.id, src: chosenPreset.src, prompt: null }); // No prompt for presets
    } else {
        // Handle edge case where continue is clicked without valid selection (though button disable should prevent this)
        console.error("Continue clicked without a valid selection.");
    }
};


  return (
    // Removed the outer duplicate div (Fix 2)
    <div
      className="w-screen h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${bground})` }}
    >
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 max-w-lg w-full">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
          Customize Kagami
        </h2>

        {/* Preset avatars */}
        <div className="flex justify-center gap-6 mb-6">
          {presets.map(({ id, src, label }) => ( // Added label for alt text
            <button
              key={id}
              onClick={() => setSelectedId(id)}
              className={`p-2 rounded-xl transition-transform ${
                selectedId === id
                  ? 'scale-110 bg-white shadow-lg ring-2 ring-green-500' // Added ring for better selection indication
                  : 'hover:scale-105'
              }`}
              aria-label={`Select ${label} avatar`} // Accessibility
            >
              <img src={src} alt={label} className="w-20 h-20 object-contain" />
            </button>
          ))}

          {/* If they’ve generated one, show it last */}
          {customSrc && (
            <button
              onClick={() => setSelectedId('custom')}
              className={`p-2 rounded-xl transition-transform ${
                selectedId === 'custom'
                  ? 'scale-110 bg-white shadow-lg ring-2 ring-green-500' // Added ring
                  : 'hover:scale-105'
              }`}
               aria-label="Select your generated avatar" // Accessibility
            >
              <img src={customSrc} alt="Your generated Kagami avatar" className="w-20 h-20 object-contain" />
            </button>
          )}
        </div>

        {/* Free‑form DALL·E prompt */}
        <div className="text-center text-sm text-gray-700 mb-2">
          Or generate your own Kagami. For best results, enter a few key
          characteristics, like: <em>“purple monkey with glasses.”</em>
        </div>
        <div className="flex items-center gap-2 mb-6">
          <input
            type="text"
            placeholder="e.g., Hippo with attitude"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="flex-1 rounded-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500" // Improved focus style
            aria-label="Enter prompt to generate a custom avatar" // Accessibility
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !customPrompt.trim()} // Also disable if prompt is empty
            className={`rounded-full p-2 w-10 h-10 flex items-center justify-center text-lg font-bold ${
                loading || !customPrompt.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600' // Changed style for active state
            } transition`}
             aria-label="Generate custom avatar" // Accessibility
          >
            {loading ? (
                 <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : '✨'} {/* Use an icon */}
          </button>
        </div>
         {/* Optional: Display error message here */}
         {/* {error && <p className="text-red-500 text-center mb-4">{error}</p>} */}

        {/* Only a Continue button this time */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            // Disable logic: nothing selected OR 'custom' is selected but customSrc is missing
            disabled={!selectedId || (selectedId === 'custom' && !customSrc)}
            className={`mt-2 bg-white text-gray-800 flex items-center gap-2 px-6 py-2 rounded-full shadow-md transition ${ // Increased padding
              !selectedId || (selectedId === 'custom' && !customSrc)
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-100 hover:shadow-lg' // Added hover shadow
            }`}
          >
            <img src={capyicon} alt="" className="w-5 h-5" /> {/* Decorative icon alt="" */}
            Continue
          </button>
        </div>

        {/* --- MODAL --- */}
        {/* Moved inside the main return block (Fix 1) */}
        {showModal && tempGeneratedUrl && ( // Added check for tempGeneratedUrl
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full text-center">
              <h3 className="text-lg font-semibold mb-4">Use this generated avatar?</h3>
              <img
                src={tempGeneratedUrl}
                alt="Generated avatar preview"
                className="w-48 h-48 object-contain mx-auto mb-6 rounded-lg border border-gray-200" // Added border/rounding
              />
              <div className="flex flex-col sm:flex-row justify-center gap-4"> {/* Stack buttons on small screens */}
                <button
                  className="bg-gray-200 px-6 py-2 rounded-full hover:bg-gray-300 transition w-full sm:w-auto" // Responsive width
                  onClick={handleCancelModal}
                >
                  Try Again
                </button>
                <button
                  className="bg-green-500 text-white px-6 py-2 rounded-full hover:bg-green-600 transition w-full sm:w-auto order-first sm:order-last" // Responsive width, Use Avatar is primary action
                  onClick={handleConfirmAvatar}
                >
                  Use Avatar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* --- END MODAL --- */}

      </div> {/* End of content card */}
    </div> // End of main background div
  );
}