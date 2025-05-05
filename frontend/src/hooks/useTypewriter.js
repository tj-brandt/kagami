import { useState, useEffect, useRef } from 'react';

function useTypewriter(texts = [], options = {}) {
  const {
    charInterval = 20,
    chunkDelay = 700,
    initialDelay = 200,
  } = options;

  const [internalTexts, setInternalTexts] = useState(texts); // Store texts internally
  const [displayedTexts, setDisplayedTexts] = useState(() => internalTexts.map(() => ''));
  const [isComplete, setIsComplete] = useState(false);

  // Refs to keep track of current position without causing effect re-runs needlessly
  const chunkIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const timeoutRef = useRef(null); // Single ref for managing timeouts

  // Effect to handle resets when the input 'texts' array changes
  useEffect(() => {
    setInternalTexts(texts); // Update internal copy
    setDisplayedTexts(texts.map(() => '')); // Reset displayed text
    chunkIndexRef.current = 0; // Reset indices
    charIndexRef.current = 0;
    setIsComplete(false); // Reset completion flag
    clearTimeout(timeoutRef.current); // Clear any pending timeout

    // Define the main typing logic function inside the effect
    const type = () => {
      // Check if we are done with all chunks
      if (chunkIndexRef.current >= internalTexts.length) {
        setIsComplete(true);
        return;
      }

      const currentChunk = internalTexts[chunkIndexRef.current];
      const currentCharIndex = charIndexRef.current;

      // Check if we are done with the current chunk
      if (currentCharIndex >= currentChunk.length) {
        // Move to the next chunk after chunkDelay
        chunkIndexRef.current += 1;
        charIndexRef.current = 0;
        timeoutRef.current = setTimeout(type, chunkDelay); // Schedule next chunk
        return;
      }

      // Type the next character
      setDisplayedTexts(prev => {
        const newTexts = [...prev];
        // Ensure the chunk exists before trying to access substring
        if (newTexts[chunkIndexRef.current] !== undefined) {
             newTexts[chunkIndexRef.current] = currentChunk.substring(0, currentCharIndex + 1);
        }
        return newTexts;
      });

      // Move to the next character index
      charIndexRef.current += 1;

      // Calculate delay for the next character
      const randomInterval = charInterval + (Math.random() - 0.5) * (charInterval * 0.5);
      const nextTimeoutDelay = Math.max(10, randomInterval);
      timeoutRef.current = setTimeout(type, nextTimeoutDelay); // Schedule next character
    };

    // Start the typing process after the initial delay
    if (texts && texts.length > 0) {
        timeoutRef.current = setTimeout(type, initialDelay);
    } else {
        setIsComplete(true); // No text, immediately complete
    }


    // Cleanup function for this effect
    return () => {
      clearTimeout(timeoutRef.current); // Clear timeout on unmount or texts change
    };
  }, [texts, charInterval, chunkDelay, initialDelay]); // Rerun ONLY if inputs change

  // This effect updates the internalTexts state if the prop changes
  // Needed because the main effect depends on the 'texts' prop directly in its dependency array
  useEffect(() => {
      setInternalTexts(texts);
  }, [texts]);


  return { displayedTexts, isComplete };
}

export default useTypewriter;