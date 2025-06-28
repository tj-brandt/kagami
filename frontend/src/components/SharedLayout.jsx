// src/components/SharedLayout.jsx
import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

function SharedLayout({ children, darkMode, toggleDarkMode }) {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      
      {/* 
      */}
      <div className="relative max-w-3xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        
        {/* Header Area */}
        <header className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-4">
          <span className="font-serif text-lg text-foreground/80 hidden sm:inline">Kagami</span>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-foreground/60 hover:bg-card hover:text-foreground transition-colors"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>
        </header>

        <main>
          {children}
        </main>
      </div>
    </div>
  );
}

export default SharedLayout;