const client = require('./client');

const noop = () => { };

const onConnection = (wss, socket) => {
  socket.server = wss;
  socket.isAlive = true;
  socket.sendSuccess = (message) => socket.send(JSON.stringify({ type: 'SUCCESS', message }));
  socket.sendError = (message) => socket.send(JSON.stringify({ type: 'ERROR', message }));
  socket.on('pong', () => socket.isAlive = true);
  socket.on('message', client.handleMessage.bind(null, socket));
  socket.on('close', client.handleClose.bind(null, socket));

  // const { roundInterval, ...data } = wss.gameState || {};
  // socket.send(JSON.stringify({ type: 'CONNECT', data }));
};

const pollClients = (wss) => (
  setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        console.debug('Terminating Client', client.gameData);
        return client.terminate();
      }
      client.isAlive = false;
      client.ping(noop);
    }
  }, 10000)
);

const onClose = (interval) => {
  clearInterval(interval);
};

module.exports = {
  onConnection,
  onClose,
  pollClients
};
