import React, { useEffect, useState } from 'react';
import './App.scss';
import Register from './components/register';
import Lobby from './components/lobby';
import Game from './components/game';

const devSocket = `ws://${document.location.hostname}:8080`;
const prodSocket = `wss://${document.location.hostname}`;
const socket = new WebSocket(process.env.NODE_ENV === 'development' ? devSocket : prodSocket);

const App = () => {
  const [gameState, setGameState] = useState({});
  const [toast, setToast] = useState({});

  useEffect(() => {
    if (!!toast.message) {
      const timer = setTimeout(() => setToast({}), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'GAME_STATE':
          setGameState(message.data);
          break;
        case 'SUCCESS':
          setToast({ message: message.message, type: 'success' });
          break;
        case 'ERROR':
          setToast({ message: message.message, type: 'error' });
          break;
        case 'BUZZ':
          setToast({ message: `${message.data.buzzer} buzzed!`, type: 'info' });
          break;
        case 'CONTINUE':
          setToast({ message: 'Round is resuming', type: 'info' });
          break;
        case 'END_ROUND':
          setToast({ message: 'Round over switching teams', type: 'info' });
          break;
        case 'OUT_OF_CARDS':
          setToast({ message: 'Out of cards', type: 'info' });
          break;
        case 'END_GAME':
          setToast({ message: 'Game over', type: 'info' });
          break;
        case 'CONNECT':
          console.debug('Game State', message);
          break;
        case 'CLOSED':
          setToast({ message: `${message.data.name} has left the game`, type: 'info' });
          break;
        case 'REJOIN':
          setToast({ message: `${message.data.name} has rejoined the game`, type: 'info' });
          break;
        default:
          console.debug('Ignoring server message', message);
          break;
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    socket.onerror = (event) => {
      event.target.isError = true;
      setToast({ message: 'Error connecting to server', type: 'error' });
    };
    socket.onclose = (event) => {
      setGameState({});
      if (!event.target.isError) {
        setToast({ message: 'Connection to server lost', type: 'error' });
      }
    };

    socket.onmessage = handleMessage;
    return () => {
      socket.close();
    }
  }, []);

  const sendMessage = (message) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return;
    }
    if (socket.readyState !== WebSocket.CONNECTING) {
      setToast({ message: 'Connection closed. Reconnecting in 3 seconds.', type: 'error' });
      setTimeout(() => window.location.reload(false), 2750);
      return;
    }
    setToast({ message: 'Connecting...', type: 'info' });
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
      <div id="toast" className={toastClasses.join(' ')} onClick={() => setToast({})}>{toast.message}</div>
    </div>
  );

}

export default App;
