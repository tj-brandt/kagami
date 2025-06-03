import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';
import kagamiDarkLogo from '../assets/kagamid.png';
import kagamiLightLogo from '../assets/kagami.png';

// Add new prop: `allowMainOverflow`
function SharedLayout({ children, darkMode, toggleDarkMode, showNavbar, allowMainOverflow }) {

  return (
    <div className="min-h-screen bg-brand-secondary dark:bg-[#020024] p-4 flex justify-center items-center font-sans">
      <div className="relative w-full max-w-[40rem] sm:max-w-[48rem] h-[90vh] rounded-large border-div-md border-brand-primary dark:border-dark-border overflow-hidden shadow-2xl flex flex-col transition-colors duration-500 bg-bg-surface-light dark:bg-dark-bg">

        {/* Top Navbar Area (Kagami Logo & Dark Mode Toggle) */}
        {showNavbar && (
          // Added relative and z-30 to ensure navbar is above potentially overflowing content from <main>
          <div className="w-full px-4 pt-4 flex justify-center transition-colors duration-500 h-[72px] sm:h-[80px] relative z-30">
            <div className={`flex items-center justify-between w-full max-w-[32rem] px-6 py-3 rounded-[40px] shadow-sm transition-colors duration-300 
              ${darkMode ? 'bg-bg-surface-light text-brand-primary' : 'bg-brand-primary text-bg-surface-light'}`}>
              
              <button
                onClick={toggleDarkMode}
                className={`p-1 rounded-full transition ${darkMode ? 'text-brand-primary' : 'text-bg-surface-light'}`}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? (
                  <SunIcon className="h-6 w-6" />
                ) : (
                  <MoonIcon className="h-6 w-6" />
                )}
              </button>

              <img
                src={darkMode ? kagamiLightLogo : kagamiDarkLogo}
                alt="Kagami Logo"
                className="h-6 w-auto"
              />

              <div className="w-6 h-6" />
            </div>
          </div>
        )}

        {/* Main content area, children (screens) will be rendered here */}
        {/* Conditionally remove overflow-hidden based on allowMainOverflow prop */}
        <main className={`flex-1 flex flex-col ${allowMainOverflow ? '' : 'overflow-hidden'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default SharedLayout;