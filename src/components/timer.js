import React, { useEffect, useState } from 'react';

const Timer = ({ gameState: { roundEnd, timeLeft } }) => {

  const [remainingTime, setTimeLeft] = useState(roundEnd - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = roundEnd - Date.now();
      setTimeLeft(remaining);
      console.log('Timer', timeLeft, remainingTime, (timeLeft || remainingTime));
      if (remaining < 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>Time Left: {Math.round((timeLeft || remainingTime) / 1000)} seconds</div>
  )
};

export default Timer;
