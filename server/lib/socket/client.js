const WebSocket = require('ws');
const utils = require('../utils');
const cards = require('../cards').map((card, index) => Object.assign(card, { index }));

// TODO reset timer to 1 minute
const LENGTH_OF_ROUND = 60 * 1000; // 1 minute in ms

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

const groupByTeams = ([...clients]) => (
  clients.reduce((teams, cur) => {
    if (cur.readyState !== WebSocket.OPEN || !cur.gameData) {
      return teams;
    }
    const existingTeamIndex = teams.findIndex(team => team.name === cur.gameData.team);
    if (existingTeamIndex >= 0) {
      teams[existingTeamIndex] = Object.assign({}, teams[existingTeamIndex], {
        players: teams[existingTeamIndex].players.concat(cur.gameData.name)
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
  }, []).sort((a, b) => a.name.localeCompare(b.name))
);

const synchronizeGameState = (server) => {
  const { roundInterval, ...data } = server.gameState;
  server.broadcast({ type: 'GAME_STATE', data });
};

const drawCard = (server) => {
  const { gameState } = server;
  const usedCards = gameState.teams.reduce((used, curTeam) => used.concat(curTeam.correct.concat(curTeam.skipped)), []);
  const availableCards = cards.filter((card) => !usedCards.includes(card.index));
  if (availableCards.length < 1) {
    console.error('Out of cards');
    server.broadcast({ type: 'OUT_OF_CARDS' });
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
  }, 500)
);

const endGame = (server) => {
  const { gameState, clients } = server;
  const gameResults = gameState.teams.map(team => (
    {
      name: team.name,
      players: team.players,
      skipped: team.skipped.map(id => cards.find(card => card.index === id).word),
      correct: team.correct.map(id => cards.find(card => card.index === id).word)
    }
  ));
  return {
    teams: groupByTeams(clients),
    gameResults
  };
};

const handleMessage = (socket, message) => {
  try {
    const event = JSON.parse(message);

    if (!socket.gameData && event.type !== 'REGISTER') {
      socket.sendError('Not registered');
      return;
    }
    const gameState = socket.server.gameState || {};
    const isGameStarted = gameState.hasOwnProperty('curTeam');
    const isRoundStarted = gameState.roundEnd > 0;
    const curTeam = gameState.teams ? gameState.teams[gameState.curTeam] : null;
    const curPlayer = curTeam ? curTeam.curPlayer : null;

    switch (event.type) {
      case 'REGISTER':
        if (isGameStarted) {
          // TODO Uncomment to prevent restarting game
          socket.sendError('Game already started');
          return;
        }
        if (socket.gameData) {
          socket.sendError('Already registered');
          return;
        }
        const { team, name } = event.data;
        if (!team || !name) {
          socket.sendError('Team and Name are required');
          return;
        }
        try {
          addTeamMember(socket, team, name);
        } catch (error) {
          socket.sendError(error.message);
          return;
        };
        console.debug('Registered', socket.gameData);
        if ((socket.server.gameState || {}).roundInterval) {
          clearInterval(socket.server.gameState.roundInterval);
        }
        socket.server.gameState = { teams: groupByTeams(socket.server.clients) };
        synchronizeGameState(socket.server);
        socket.sendSuccess(`Registered as ${name} on team ${team}`);
        break;
      case 'REJOIN':
        // TODO Implement rejoining in middle of game
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
        socket.server.gameState = { teams: groupByTeams(socket.server.clients) };
        synchronizeGameState(socket.server);
        socket.sendSuccess(`Changed to team ${socket.gameData.team}`);
        break;
      case 'START_GAME':
        if (isGameStarted) {
          socket.sendError('Game already started');
          return;
        }
        const { teams } = socket.server.gameState;
        for (const team of teams) {
          if (team.players.length < 2) {
            socket.sendError('All teams need at least 2 players.');
            return;
          }
        }

        // TODO restore random first round selection
        const firstTeamIndex = Math.floor(Math.random() * teams.length);
        const firstPlayer = utils.getRandomElement(teams[firstTeamIndex].players);
        // const firstTeamIndex = 0;
        // const firstPlayer = teams[firstTeamIndex].players[0];
        teams[firstTeamIndex].curPlayer = firstPlayer;
        if ((socket.server.gameState || {}).roundInterval) {
          clearInterval(socket.server.gameState.roundInterval);
        }
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
        socket.server.gameState = drawCard(socket.server);
        synchronizeGameState(socket.server);
        console.debug('Starting round', socket.server.gameState);
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
        curTeam.skipped = curTeam.skipped.concat(gameState.card.index);
        socket.server.gameState = drawCard(socket.server);
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
        curTeam.correct = curTeam.correct.concat(gameState.card.index);
        socket.server.gameState = drawCard(socket.server);
        synchronizeGameState(socket.server);
        break;
      case 'BUZZ': // Pause timer
        if (!isGameStarted) {
          socket.sendError('Game is not started yet');
          return;
        }
        if (!isRoundStarted) {
          socket.sendError('Cannot buzz before round starts');
          return;
        }
        if(curTeam.name === socket.gameData.team){
          socket.sendError('Cannot buzz your own team');
          return;
        }
        const timeLeft = gameState.roundEnd - Date.now();
        clearInterval(gameState.roundInterval);
        gameState.roundEnd = -1;
        gameState.timeLeft = timeLeft;
        gameState.buzzer = socket.gameData.name;
        socket.server.gameState = gameState;
        synchronizeGameState(socket.server);
        socket.server.broadcast({ type: 'BUZZ', data: { buzzer: gameState.buzzer } });
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
        delete gameState.buzzer;
        delete gameState.timeLeft
        gameState.roundInterval = startRound(socket.server);
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
        curTeam.skipped = curTeam.skipped.concat(gameState.card.index);
        gameState.roundEnd = Date.now() + gameState.timeLeft;
        delete gameState.buzzer;
        delete gameState.timeLeft
        gameState.roundInterval = startRound(socket.server);
        socket.server.gameState = drawCard(gameState);
        synchronizeGameState(socket.server);
        socket.server.broadcast({ type: 'CONTINUE' });
        break;
      case 'END_GAME':
        socket.server.gameState = endGame(socket.server);
        synchronizeGameState(socket.server);
        socket.server.broadcast({ type: 'END_GAME' });
        console.debug('Game over', socket.server.gameState);
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
