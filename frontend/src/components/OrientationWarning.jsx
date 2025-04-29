import { useState, useEffect } from 'react';

export default function OrientationWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isLandscape = window.matchMedia("(orientation: landscape)").matches;
      const isSmallScreen = window.innerWidth <= 768; // Tailwind 'md' breakpoint (or customize)

      if (isLandscape && isSmallScreen) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    checkOrientation(); // Check immediately when component mounts

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
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
