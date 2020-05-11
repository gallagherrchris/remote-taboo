const fs = require('fs');
const path = require('path');
const express = require('express');
const favicon = require('express-favicon');
const http = require('http');
const WebSocket = require('ws');

const socketHandler = require('./lib/socket');

const port = process.env.PORT || 8080;
const app = express();

const loadCards = () => {
  const rawCards = fs.readFileSync(path.join(__dirname, 'raw_cards.txt')).toString().trim();
  return rawCards.split(/\r?\n/).map((line, index) => {
    const rawWords = line.split(' ');
    if (rawWords.length !== 6) {
      throw new Error(`Malformed card entry: ${rawWords[0]}`);
    }
    const words = rawWords.map(word => word.replace(/([^-])-([^-])/g, '$1 $2').replace(/--/g, '-'));
    const [word, ...taboo] = words;
    return { word, taboo, index };
  });
};

// the __dirname is the current directory from where the script is running
const appRoot = path.join(__dirname, '..', 'build');

app.use(favicon(path.join(appRoot, 'favicon.ico')));
app.use(express.static(path.join(__dirname, '..')));
app.use(express.static(path.join(appRoot)));

app.get('/ping', function (req, res) {
  return res.send('pong');
});

app.get('/*', function (req, res) {
  res.sendFile(path.join(appRoot, 'index.html'));
});

const httpServer = http.createServer(app);
const wss = new WebSocket.Server({
  server: httpServer,
  clientTracking: true
});
wss.games = {};
wss.cards = loadCards();
console.debug(`Loaded ${wss.cards.length} cards`);
wss.broadcast = (game, message) => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && (client.gameData || {}).game === game) {
      const userMessage = Object.assign({}, message, { data: { ...message.data, user: client.gameData } });
      client.send(JSON.stringify(userMessage));
    }
  }
};
wss.updateGameState = (game, gameState) => {
  wss.games[game] = Object.freeze(gameState);
  const { roundInterval, ...data } = wss.games[game] || {};
  wss.broadcast(game, { type: 'GAME_STATE', data });
}

wss.on('connection', socketHandler.onConnection.bind(null, wss));
const clientPoll = socketHandler.pollClients(wss);
wss.on('close', socketHandler.onClose.bind(null, clientPoll));

httpServer.listen(port, () => console.debug('Listening on port', port));
