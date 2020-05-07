const client = require('./client');

const noop = () => { };

const onConnection = (wss, socket, req) => {
  socket.server = wss;
  socket.isAlive = true;
  socket.sendSuccess = (data) => socket.send(JSON.stringify({ type: 'SUCCESS', data }));
  socket.sendError = (message) => socket.send(JSON.stringify({ type: 'ERROR', message }));
  socket.on('pong', () => socket.isAlive = true);
  socket.on('message', client.handleMessage.bind(null, socket));
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
