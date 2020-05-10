const GameError = require('./gameError');

const organizeTeams = (teams) => (
  [...teams].sort((a, b) => a.name.localeCompare(b.name))
);

const getCurrentGame = (server, game) => {
  if (!server.games.hasOwnProperty(game)) {
    throw new GameError(`Game ${game} does not exist`);
  }
  const currentGame = server.games[game];
  return Object.assign({}, currentGame, {
    isStarted: currentGame.hasOwnProperty('curTeam')
  });
}

const addPlayer = (server, game, name) => {
  if (!game || !name) {
    throw new GameError('Game and Name are required');
  }
  if (!server.games[game]) {
    server.games[game] = {
      teams: [],
      audience: [],
    };
  }
  const currentGame = server.games[game];
  const existingAudienceMemeber = currentGame.audience.find(p => p === name);
  const existingPlayer = currentGame.teams.find(team => team.players.includes(name));
  if (existingAudienceMemeber || existingPlayer) {
    throw new GameError('Name already in use');
  }
  return Object.assign({}, currentGame, {
    audience: [].concat(currentGame.audience, name)
  });
};

const rejoin = (server, { game, name }) => {

};

const changeTeam = (server, newTeam, { game, name }) => {
  if (!newTeam) {
    throw new GameError('Team is required');
  }
  let currentGame = getCurrentGame(server, game);
  if (currentGame.isStarted) {
    throw new GameError('Game already started');
  }
  const curTeamIndex = currentGame.teams.findIndex(team => team.players.includes(name));
  if (curTeamIndex < 0) { // Joining team
    const playerIndex = currentGame.audience.findIndex(a => a === name);
    currentGame = Object.assign({}, currentGame, {
      audience: [].concat(currentGame.audience.splice(0, playerIndex), currentGame.audience.splice(playerIndex + 1))
    });
  } else { // Remove player from existing team
    const curTeamPlayerIndex = currentGame.teams[curTeamIndex].players.findIndex(p => p === name);
    currentGame.teams[curTeamIndex].players = [].concat(
      currentGame.teams[curTeamIndex].players.splice(0, curTeamPlayerIndex),
      currentGame.teams[curTeamIndex].players.splice(curTeamPlayerIndex + 1)
    );
  }
  const existingTeamIndex = currentGame.teams.findIndex(team => team.name === newTeam);
  if (existingTeamIndex < 0) {
    currentGame = Object.assign({}, currentGame, {
      teams: [].concat(currentGame.teams, {
        name: newTeam,
        players: [name],
        correct: [],
        skipped: []
      })
    })
  } else {
    currentGame.teams[existingTeamIndex].players = [...currentGame.teams[existingTeamIndex].players, name];
  }
  return Object.assign({}, currentGame, {
    teams: organizeTeams(currentGame.teams)
  });
};

const leaveGame = (server, gameData) => {
  const { game, name } = gameData;
  const { terminated = [] } = server;
  const wasTerminated = !!terminated.find(terminatedData => terminatedData.name === name && terminatedData.game === game);
  let currentGame = getCurrentGame(server, game);
  if (!wasTerminated) {
    server.terminated = [].concat(terminated, gameData);

    const curTeamIndex = currentGame.teams.findIndex(team => team.players.includes(name));
    if (curTeamIndex >= 0) {
      const players = currentGame.teams[curTeamIndex].players
      currentGame.teams[curTeamIndex].players = [].concat(players.splice(0, curTeamIndex), players.splice(curTeamIndex + 1));
    }
    const audienceIndex = currentGame.audience.findIndex(p => p === name);
    if (audienceIndex >= 0) {
      currentGame = Object.assign({}, currentGame, {
        audience: [].concat(currentGame.audience.splice(0, audienceIndex), currentGame.audience.splice(audienceIndex + 1))
      });
    }
    server.broadcast(game, { type: 'CLOSED', data: gameData });
    if (!currentGame.isStarted) {
      // Remove empty teams if game not started
      currentGame = Object.assign({}, currentGame, {
        teams: organizeTeams(currentGame.teams.filter(team => team.players.length > 0))
      });
    }
    // If no players remain return null
    const remainingPlayers = currentGame.teams.reduce((all, team) => [].concat(all, team.players), []);
    if (remainingPlayers.length + currentGame.audience.length < 1) {
      return null;
    }
  }
  return currentGame;
};

module.exports = {
  addPlayer,
  rejoin,
  changeTeam,
  leaveGame
};
