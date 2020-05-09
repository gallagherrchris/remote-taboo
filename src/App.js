import React, { useEffect, useState } from 'react';
import './App.scss';
import Register from './components/register';
import Lobby from './components/lobby';
import Game from './components/game';

console.log('NODE_ENV', process.env.NODE_ENV);
const devSocket = `ws://${document.location.hostname}:8080`;
const prodSocket = `wss://${document.location.hostname}`;
const socket = new WebSocket(process.env.NODE_ENV === 'development' ? devSocket : prodSocket);

const App = () => {
  const [gameState, setGameState] = useState({});
  const [toast, setToast] = useState({});

  const showToast = (message, type) => {
    setToast({ type, message });
    setTimeout(() => setToast({}), 3000);
  };

  const handleMessage = (event) => {
    console.log('Handling Message', event);
    try {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'GAME_STATE':
          setGameState(message.data);
          break;
        case 'SUCCESS':
          showToast(message.message, 'success');
          break;
        case 'ERROR':
          showToast(message.message, 'error');
          break;
        case 'BUZZ':
          showToast(`${message.data.buzzer} buzzed!`, 'success');
          break;
        case 'CONTINUE':
          showToast('Round is resuming', 'success');
          break;
        case 'END_ROUND':
          showToast('Round over switching teams', 'success');
          break;
        case 'OUT_OF_CARDS':
          showToast('Out of cards. Ending game');
          break;
        case 'END_GAME':
          showToast('Game over');
          break;
        case 'CONNECT':
          console.log('Game State', message);
          break;
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    socket.onerror = (event) => {
      console.error(event);
      showToast('Error connecting to server', 'error');
    };
    socket.onclose = (event) => {
      setGameState({});
      showToast('Connection to server lost', 'error');
      // console.log(event);
      // if (!toast.message) {
      //   showToast('Connection closed. Reconnecting in 3 seconds', 'error');
      //   setTimeout(() => window.location.reload(false), 3000);
      // }
    };

    socket.onmessage = handleMessage;
    return () => {
      socket.close();
    }
  }, [socket]);

  const sendMessage = (message) => {
    if (socket.readyState !== WebSocket.OPEN) {
      showToast('Connection Lost. Reconnecting in 3 seconds.', 'error');
      setTimeout(() => window.location.reload(false), 2750);
      return;
    }
    socket.send(JSON.stringify(message));
  };

  const toastClasses = [
    !!toast.message ? 'show' : '',
    toast.type === 'error' ? 'error' : ''
  ];

  const getMode = () => {
    if (!gameState.user) {
      return <Register sendMessage={sendMessage} />;
    }
    if (!gameState.hasOwnProperty('curTeam')) {
      return <Lobby sendMessage={sendMessage} gameState={gameState} />;
    }
    return <Game sendMessage={sendMessage} gameState={gameState} />
  };

  return (
    <div className="App">
      {getMode()}
      {/* <pre>{JSON.stringify(gameState, null, 2)}</pre> */}
      <div id="toast" className={toastClasses.join(' ')}>{toast.message}</div>
    </div>
  );

}

export default App;
