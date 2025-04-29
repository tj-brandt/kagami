import { useState, useEffect } from 'react';

export default function OrientationWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      setShowWarning(isLandscape && isMobile);
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    checkOrientation(); // Initial check
    const timeoutId = setTimeout(checkOrientation, 500); // Re-check after a short delay

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[9999] p-8">
      <h1 className="text-white text-3xl font-bold mb-4">Please Rotate Your Device</h1>
      <p className="text-white text-lg">Kagami Café is best experienced in portrait mode!</p>
    </div>
  );
}
