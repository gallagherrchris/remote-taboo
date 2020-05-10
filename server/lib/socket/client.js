const WebSocket = require('ws');
const utils = require('../utils');
const cards = require('../cards').map((card, index) => Object.assign(card, { index }));

const LENGTH_OF_ROUND = 60 * 1000; // 1 minute in ms
const isDev = process.env.NODE_ENV === 'development';

const addTeamMember = (clients, team, name) => {
  for (const client of clients) {
    const clientData = client.gameData || {};
    if (client.readyState !== WebSocket.OPEN || clientData.team !== team) {
      continue;
    }
    if (clientData.name.toLowerCase() === name.toLowerCase()) {
      throw new Error('Name already in use');
    }
  }
  return { team, name };
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

const syncTeams = (newTeams, existingTeams) => (
  newTeams.map(team => {
    const existingTeam = existingTeams.find(t => t.name === team.name);
    if (existingTeam) {
      if (existingTeam.hasOwnProperty('curPlayer')) {
        team.curPlayer = existingTeam.curPlayer
      };
      return Object.assign({}, team, {
        correct: existingTeam.correct,
        skipped: existingTeam.skipped
      });
    }
    return team;
  })
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


const synchronizeGameState = (server) => {
  const { roundInterval, ...data } = server.gameState || {};
  server.broadcast({ type: 'GAME_STATE', data });
};

const drawCard = (server) => {
  const { gameState } = server;
  const usedCards = gameState.teams.reduce((used, curTeam) => used.concat(curTeam.correct.concat(curTeam.skipped)), []);
  const availableCards = cards.filter((card) => !usedCards.includes(card.index));
  if (availableCards.length < 1) {
    console.error('Out of cards');
    server.broadcast({ type: 'OUT_OF_CARDS' });
    return endGame(server);
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

const rejoin = (socket, team, name) => {
  const { server } = socket;
  const { terminated = [] } = server;
  const terminatedIndex = terminated.findIndex(({ name: pName, team: pTeam }) => name === pName && team === pTeam);
  if (terminatedIndex < 0) {
    throw new Error('You were not part of this game');
  }
  socket.gameData = addTeamMember(server.clients, team, name);
  server.terminated = terminated.slice(0, terminatedIndex).concat(terminated.slice(terminatedIndex + 1));
  console.debug('Rejoined', socket.gameData);

  server.gameState.teams = syncTeams(groupByTeams(server.clients), server.gameState.teams);
  synchronizeGameState(server);
  socket.sendSuccess('Re-joined game');
  server.broadcast({ type: 'REJOIN', data: socket.gameData });
};

const handleMessage = (socket, message) => {
  try {
    const event = JSON.parse(message);

    if (!socket.gameData && event.type !== 'REGISTER') {
      socket.sendError('Not registered');
      return;
    }
    const { server } = socket;
    const { gameState = {}, clients } = server;
    const isGameStarted = gameState.hasOwnProperty('curTeam');
    const isRoundStarted = gameState.roundEnd > 0;
    const curTeam = gameState.teams ? gameState.teams[gameState.curTeam] : null;
    const curPlayer = curTeam ? curTeam.curPlayer : null;

    switch (event.type) {
      case 'REGISTER':
        if (socket.gameData) {
          socket.sendError('Already registered');
          return;
        }
        const { team, name } = event.data;
        if (!team || !name) {
          socket.sendError('Team and Name are required');
          return;
        }
        if (isGameStarted) {
          try {
            rejoin(socket, team, name);
          } catch (error) {
            socket.sendError(error.message);
            console.error(error);
          } finally { return; }
        }
        try {
          socket.gameData = addTeamMember(clients, team, name);
        } catch (error) {
          socket.sendError(error.message);
          return;
        };
        console.debug('Registered', socket.gameData);
        if (gameState.roundInterval) {
          clearInterval(gameState.roundInterval);
        }
        server.gameState.teams = groupByTeams(clients);
        synchronizeGameState(server);
        socket.sendSuccess(`Registered as ${name} on team ${team}`);
        break;
      case 'REJOIN':
        if (!event.data.team || !event.data.name) {
          socket.sendError('Team and Name are required');
          return;
        }
        const { terminated = [] } = server;
        const terminatedIndex = terminated.findIndex(({ name, team }) => event.data.name === name && event.data.team === team);
        if (terminatedIndex < 0) {
          socket.sendError('You were not part of this game');
          return;
        }
        try {
          socket.gameData = addTeamMember(clients, team, name);
        } catch (error) {
          socket.sendError(error.message);
          return;
        };
        server.terminated = terminated.slice(0, terminatedIndex).concat(terminated.slice(terminatedIndex + 1));
        console.debug('Rejoined', socket.gameData);
        server.gameState.teams = groupByTeams(clients);
        synchronizeGameState(server);
        socket.sendSuccess('Re-joined game');
        server.broadcast({ type: 'REJOIN', data: socket.gameData });
        break;
      case 'CHANGE_TEAM':
        if (isGameStarted) {
          socket.sendError('Game already started');
          return;
        }
        try {
          socket.gameData = addTeamMember(clients, event.data, socket.gameData.name);
        } catch (error) {
          socket.sendError(error.message);
          return;
        }
        server.gameState.teams = groupByTeams(clients);
        synchronizeGameState(server);
        socket.sendSuccess(`Changed to team ${socket.gameData.team}`);
        break;
      case 'START_GAME':
        if (isGameStarted) {
          socket.sendError('Game already started');
          return;
        }
        for (const team of gameState.teams) {
          if (team.players.length < 2) {
            socket.sendError('All teams need at least 2 players.');
            return;
          }
        }

        const firstTeamIndex = isDev ? 0 : Math.floor(Math.random() * gameState.teams.length);
        const firstPlayer = isDev ? gameState.teams[firstTeamIndex].players[0] : utils.getRandomElement(gameState.teams[firstTeamIndex].players);
        gameState.teams[firstTeamIndex].curPlayer = firstPlayer;
        if (gameState.roundInterval) {
          clearInterval(gameState.roundInterval);
        }
        server.gameState = {
          teams: gameState.teams,
          curTeam: firstTeamIndex
        }
        synchronizeGameState(server);
        console.debug('Starting Game', server.gameState);
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
        gameState.roundInterval = startRound(server);
        server.gameState = drawCard(server);
        synchronizeGameState(server);
        console.debug('Starting round', server.gameState);
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
        server.gameState = drawCard(server);
        synchronizeGameState(server);
        server.broadcast({ type: 'SKIPPED', data: gameState.card });
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
        server.gameState = drawCard(server);
        synchronizeGameState(server);
        server.broadcast({ type: 'CORRECT', data: gameState.card });
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
        if (curTeam.name === socket.gameData.team) {
          socket.sendError('Cannot buzz your own team');
          return;
        }
        const timeLeft = gameState.roundEnd - Date.now();
        clearInterval(gameState.roundInterval);
        gameState.roundEnd = -1;
        gameState.timeLeft = timeLeft;
        gameState.buzzer = socket.gameData.name;
        server.gameState = gameState;
        synchronizeGameState(server);
        server.broadcast({ type: 'BUZZ', data: { buzzer: gameState.buzzer } });
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
        gameState.roundInterval = startRound(server);
        server.gameState = gameState;
        synchronizeGameState(server);
        server.broadcast({ type: 'CONTINUE' });
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
        gameState.roundInterval = startRound(server);
        server.gameState = drawCard(gameState);
        synchronizeGameState(server);
        server.broadcast({ type: 'CONTINUE' });
        break;
      case 'END_GAME':
        server.gameState = endGame(server);
        synchronizeGameState(server);
        server.broadcast({ type: 'END_GAME' });
        console.debug('Game over', server.gameState);
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

const handleClose = (socket) => {
  if (!socket.hasOwnProperty('gameData')) {
    return;
  }
  const { server, gameData = {} } = socket;
  const { terminated = [], gameState } = server;
  const wasTerminated = !!terminated.find(({ name, team }) => gameData.name === name && gameData.team === team);
  if (!wasTerminated) {
    server.terminated = [].concat(terminated, socket.gameData);
    server.gameState.teams = syncTeams(groupByTeams(server.clients), gameState.teams);
    synchronizeGameState(server);
    server.broadcast({ type: 'CLOSED', data: socket.gameData });
    console.debug('Closed', socket.gameData, server.terminated);
  }
};

module.exports = {
  handleMessage,
  handleClose
};
