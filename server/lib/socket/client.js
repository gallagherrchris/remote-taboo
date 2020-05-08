const WebSocket = require('ws');
const utils = require('../utils');
const cards = require('../cards').map((card, index) => Object.assign(card, { index }));

const LENGTH_OF_ROUND = 10 * 1000; // 1 minute in ms

const addTeamMember = (socket, team, name) => {
  for (const client of socket.server.clients) {
    const clientData = client.gameData || {};
    if (client.readyState !== WebSocket.OPEN || clientData.team !== team) {
      continue;
    }
    if (clientData.name.toLowerCase() === name.toLowerCase()) {
      throw new Error('Name already in use');
    }
  }
  socket.gameData = { team, name };
};

const groupByTeams = ([...clients]) => {
  return clients.reduce((teams, cur) => {
    if (cur.readyState !== WebSocket.OPEN || !cur.gameData) {
      return teams;
    }
    const existingTeamIndex = teams.findIndex(team => team.name === cur.gameData.team);
    if (existingTeamIndex >= 0) {
      teams[existingTeamIndex] = Object.assign({}, teams[existingTeamIndex], {
        players: teams[existingTeamIndex].players.concat(cur.name)
      });
      return teams;
    } else {
      return teams.concat({
        name: cur.gameData.team,
        players: [cur.gameData.name],
        correct: [],
        skipped: []
      });
    }
  }, []);
};

const synchronizeGameState = (server) => {
  const { roundInterval, ...data } = server.gameState;
  server.broadcast({ type: 'GAME_STATE', data });
};

const drawCard = (gameState) => {
  const usedCards = gameState.teams.reduce((used, curTeam) => used.concat(curTeam.correct.concat(curTeam.skipped)), []);
  const availableCards = cards.filter((card) => !usedCards.includes(card.index));
  if (availableCards.length < 1) {
    console.error('Out of cards');
    return null;
  }
  return Object.assign({}, gameState, {
    card: utils.getRandomElement(availableCards)
  });
};

const startRound = (server) => (
  setInterval(() => {
    const { gameState } = server;
    const timeLeft = gameState.roundEnd - Date.now();
    if (timeLeft < 1) {
      clearInterval(gameState.roundInterval);
      const nextIndex = gameState.curTeam + 1 >= gameState.teams.length ? 0 : gameState.curTeam + 1;
      const nextTeam = gameState.teams[nextIndex];
      if (nextTeam.curPlayer) {
        nextTeam.curPlayer = utils.getNextElement(nextTeam.players, nextTeam.players.findIndex(player => player === nextTeam.curPlayer));
      } else {
        nextTeam.curPlayer = utils.getRandomElement(nextTeam.players);
      }
      server.gameState = Object.assign({}, gameState, {
        roundEnd: -1,
        curTeam: nextIndex,
        card: undefined
      });
      synchronizeGameState(server);
      server.broadcast({ type: 'END_ROUND' });
    }
    console.log('Round Heartbeat', timeLeft);
  }, 750)
);

const handleMessage = (socket, message) => {
  try {
    const event = JSON.parse(message);

    if (!socket.gameData && event.type !== 'REGISTER') {
      socket.sendError('Not registered');
      return;
    }
    const gameState = socket.server.gameState || {};
    const isGameStarted = gameState.hasOwnProperty('curTeam');
    const curTeam = gameState.teams ? gameState.teams[gameState.curTeam] : null;
    const curPlayer = curTeam ? curTeam.curPlayer : null;

    switch (event.type) {
      case 'REGISTER':
        if (isGameStarted) {
          socket.sendError('Game already started');
          return;
        }
        if (socket.gameData) {
          socket.sendError('Already registered');
          return;
        }
        const { team, name } = event.data;
        try {
          addTeamMember(socket, team, name);
        } catch (error) {
          socket.sendError(error.message);
          return;
        };
        console.debug('Registered', socket.gameData);
        socket.sendSuccess(socket.gameData);
        break;
      case 'CHANGE_TEAM':
        if (isGameStarted) {
          socket.sendError('Game already started');
          return;
        }
        try {
          addTeamMember(socket, event.data, socket.gameData.name);
        } catch (error) {
          socket.sendError(error.message);
          return;
        }
        socket.sendSuccess(socket.gameData);
        break;
      case 'START_GAME':
        if(isGameStarted){
          socket.sendError('Game already started');
          return;
        }
        // TODO ensure at least 2 players per team
        const teams = groupByTeams(socket.server.clients);
        const firstTeamIndex = Math.floor(Math.random() * teams.length);
        const firstPlayer = utils.getRandomElement(teams[firstTeamIndex].players);
        teams[firstTeamIndex].curPlayer = firstPlayer;
        socket.server.gameState = {
          teams,
          curTeam: firstTeamIndex
        }
        synchronizeGameState(socket.server);
        console.debug('Starting Game', socket.server.gameState);
        break;
      case 'START_ROUND': // Start timer. Display next card
        if (!isGameStarted) {
          socket.sendError('Game is not started yet');
          return;
        }
        if (socket.gameData.name !== curPlayer) {
          socket.sendError('Not your turn');
          return;
        }
        gameState.roundEnd = Date.now() + LENGTH_OF_ROUND;
        gameState.roundInterval = startRound(socket.server);
        socket.server.gameState = drawCard(gameState);
        synchronizeGameState(socket.server);
        break;
      case 'SKIP': // Display next card.  No points
        if (!isGameStarted) {
          socket.sendError('Game is not started yet');
          return;
        }
        if (socket.gameData.name !== curPlayer) {
          socket.sendError('Not your turn');
          return;
        }
        gameState.teams[socket.gameData.team].skipped = gameState.teams[socket.gameData.team].skipped.concat(gameState.card.index);
        socket.server.gameState = drawCard(gameState);
        synchronizeGameState(socket.server);
        break;
      case 'CORRECT': // Display next card. 1 point
        if (!isGameStarted) {
          socket.sendError('Game is not started yet');
          return;
        }
        if (socket.gameData.name !== curPlayer) {
          socket.sendError('Not your turn');
          return;
        }
        gameState.teams[socket.gameData.team].correct = gameState.teams[socket.gameData.team].correct.concat(gameState.card.index);
        socket.server.gameState = drawCard(gameState);
        synchronizeGameState(socket.server);
        break;
      case 'BUZZ': // Pause timer
        if (!isGameStarted) {
          socket.sendError('Game is not started yet');
          return;
        }
        const timeLeft = gameState.roundEnd - Date.now();
        gameState.roundEnd = -1;
        gameState.timeLeft = timeLeft;
        socket.server.gameState = gameState;
        synchronizeGameState(socket.server);
        socket.server.broadcast({ type: 'BUZZ' });
        break;
      case 'BUZZ_INVALID': // Continue timer
        if (!isGameStarted) {
          socket.sendError('Game is not started yet');
          return;
        }
        if (socket.gameData.name !== curPlayer) {
          socket.sendError('Not your turn');
          return;
        }
        gameState.roundEnd = Date.now() + gameState.timeLeft;
        socket.server.gameState = gameState;
        synchronizeGameState(socket.server);
        socket.server.broadcast({ type: 'CONTINUE' });
        break;
      case 'BUZZ_VALID': // Continue timer display next card
        if (!isGameStarted) {
          socket.sendError('Game is not started yet');
          return;
        }
        if (socket.gameData.name !== curPlayer) {
          socket.sendError('Not your turn');
          return;
        }
        gameState.roundEnd = Date.now() + gameState.timeLeft;
        socket.server.gameState = gameState;
        synchronizeGameState(socket.server);
        socket.server.broadcast({ type: 'CONTINUE' });
        break;
      default:
        console.debug('Unknown TYPE', event.type);
        socket.sendError(`Unknown TYPE:${event.type}`);
        break;
    }
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  handleMessage
};
