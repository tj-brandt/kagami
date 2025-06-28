// src/components/LoadingScreen.jsx
import React from 'react';

const Spinner = () => (
  <svg
    className="animate-spin h-6 w-6 text-primary"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      
      {/* Logo Text */}
      <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-8">
        Kagami
      </h1>

      {/* Spinner and Loading Text */}
      <div className="flex items-center gap-4">
        <Spinner />
        <p className="text-lg text-foreground/80">Loading...</p>
      </div>
    </div>
  );
}