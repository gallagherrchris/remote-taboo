const path = require('path');
const express = require('express');
const favicon = require('express-favicon');
const http = require('http');
const WebSocket = require('ws');

const socketHandler = require('./lib/socket');

const port = process.env.PORT || 8080;
const app = express();

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
wss.broadcast = (message) => {
  for(const client of wss.clients) {
    if(client.readyState === WebSocket.OPEN){
      client.send(JSON.stringify(message));
    }
  }
};

wss.on('connection', socketHandler.onConnection.bind(null, wss));
const clientPoll = socketHandler.pollClients(wss);
wss.on('close', socketHandler.onClose.bind(null, clientPoll));

httpServer.listen(port, () => console.log('Listening on port', port));
