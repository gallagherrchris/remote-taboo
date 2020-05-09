import React, { useEffect, useState } from 'react';

const Timer = ({ gameState: { roundEnd, timeLeft } }) => {

  const [remainingTime, setTimeLeft] = useState(roundEnd - Date.now());

  useEffect(() => {
    console.log('Timer updating interval');
    const interval = setInterval(() => {
      const remaining = roundEnd - Date.now();
      if (remaining < 0) {
        clearInterval(interval);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [roundEnd]);

  return (
    <div>Time Left: {Math.round((timeLeft || remainingTime) / 1000)} seconds</div>
  )
};

export default Timer;
