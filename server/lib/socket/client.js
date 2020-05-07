const WebSocket = require('ws');

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

const groupByTeams = (clients) => {
  const teamMap = {};
  for (const client of clients) {
    if (client.readyState !== WebSocket.OPEN || !client.gameData) {
      continue;
    }
    if (!teamMap[client.gameData.team]) {
      teamMap[client.gameData.team] = [];
    }
    client.gameData.position = teamMap[client.gameData.team].length;
    teamMap[client.gameData.team].push(client);
  }
  return teamMap;
};

const handleMessage = (socket, message) => {
  try {
    const event = JSON.parse(message);

    if (!socket.gameData && event.type !== 'REGISTER') {
      socket.sendError('Not registered');
      return;
    }

    switch (event.type) {
      case 'REGISTER':
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
        try {
          addTeamMember(socket, event.data, socket.gameData.name);
        } catch (error) {
          socket.sendError(error.message);
          return;
        }
        socket.sendSuccess(socket.gameData);
        break;
      case 'START_GAME':
        const gameState = {};
        const teams = groupByTeams(socket.server.clients);
        gameState.teams = teams;
        // Assign player positions
        // Pick starting team
        // Pick clue giving player
        // Pick card
        // Start timer
        break;
      case 'SKIP': // Display next card.  No points
        break;
      case 'CORRECT': // Display next card. 1 point
        break;
      case 'BUZZ': // Pause timer
        break;
      case 'BUZZ_INVALID': // Continue timer
        break;
      case 'BUZZ_VALID': // Continue timer display next card
        break;
    }
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  handleMessage
};
