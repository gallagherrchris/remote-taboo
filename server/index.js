const express = require('express');
const favicon = require('express-favicon');
const path = require('path');

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

app.listen(port);
