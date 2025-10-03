// src/hooks/useChatTimer.js
import { useState, useEffect, useRef } from 'react';

function useChatTimer(durationInSeconds, onEnd, isActive = true) {
  const [remainingTime, setRemainingTime] = useState(durationInSeconds);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const intervalId = setInterval(() => {
      setRemainingTime(prevTime => {
        if (prevTime <= 1) {
          clearInterval(intervalId);
          if (onEndRef.current) {
            onEndRef.current(); 
          }
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
    
  }, [isActive]);

  return { remainingTime };
}

export default useChatTimer;