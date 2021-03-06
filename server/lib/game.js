const GameError = require('./gameError');

const LENGTH_OF_ROUND = (process.env.NODE_ENV === 'development' ? 10 : 60) * 1000; // 1 minute in ms

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getNextElement = (arr, curIndex) => {
  if (curIndex + 1 >= arr.length) {
    return arr[0];
  }
  return arr[curIndex + 1];
}

const drawCard = (allCards, currentGame) => {
  const usedCards = currentGame.teams.reduce((used, curTeam) => used.concat(curTeam.correct.concat(curTeam.skipped)), []);
  const availableCards = allCards.filter((card) => !usedCards.includes(card.index));
  if (availableCards.length < 1) {
    throw new GameError('Out of cards');
  }
  return getRandomElement(availableCards);
};

const organizeTeams = (teams) => (
  [...teams].sort((a, b) => a.name.localeCompare(b.name))
);

const getCurrentGame = (server, game) => {
  if (!server.games.hasOwnProperty(game)) {
    throw new GameError(`Game ${game} does not exist`);
  }
  const currentGame = server.games[game];
  return Object.assign({}, currentGame, {
    isStarted: currentGame.hasOwnProperty('curTeam'),
    isRoundStarted: currentGame.hasOwnProperty('roundEnd')
  });
}

const addPlayer = (server, socket, game, name) => {
  if (!game || !name) {
    throw new GameError('Game and Name are required');
  }
  if (name.length > 12) {
    throw new GameError('Name cannot be longer than 12 characters');
  }
  if (game.length > 12) {
    throw new GameError('Game cannot be longer than 12 characters');
  }
  if (server.terminated) {
    const terminatedIndex = server.terminated.findIndex(terminatedData => terminatedData.name === name && terminatedData.game === game);
    if (terminatedIndex >= 0) {
      socket.gameData = server.terminated[terminatedIndex];
      server.terminated = [].concat(server.terminated.slice(0, terminatedIndex), server.terminated.slice(terminatedIndex + 1));
      const currentGame = getCurrentGame(server, game);
      const teamIndex = currentGame.teams.findIndex(team => team.name === socket.gameData.team);
      if (teamIndex >= 0) {
        currentGame.teams[teamIndex].players = [].concat(currentGame.teams[teamIndex].players, socket.gameData.name);
        return currentGame;
      }
    }
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

const changeTeam = (server, newTeam, { game, name }) => {
  if (!newTeam) {
    throw new GameError('Team is required');
  }
  if (newTeam.length > 20) {
    throw new GameError('Team name cannot be longer than 20 characters');
  }
  let currentGame = getCurrentGame(server, game);
  if (currentGame.isStarted) {
    throw new GameError('Game already started');
  }
  const curTeamIndex = currentGame.teams.findIndex(team => team.players.includes(name));
  if (curTeamIndex < 0) { // Joining team
    const playerIndex = currentGame.audience.findIndex(a => a === name);
    currentGame = Object.assign({}, currentGame, {
      audience: [].concat(currentGame.audience.slice(0, playerIndex), currentGame.audience.slice(playerIndex + 1))
    });
  } else { // Remove player from existing team
    const curTeamPlayerIndex = currentGame.teams[curTeamIndex].players.findIndex(p => p === name);
    currentGame.teams[curTeamIndex].players = [].concat(
      currentGame.teams[curTeamIndex].players.slice(0, curTeamPlayerIndex),
      currentGame.teams[curTeamIndex].players.slice(curTeamPlayerIndex + 1)
    );
    if (currentGame.teams[curTeamIndex].players.length < 1) {
      currentGame = Object.assign({}, currentGame, {
        teams: [].concat(currentGame.teams.slice(0, curTeamIndex), currentGame.teams.slice(curTeamIndex + 1))
      });
    }
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
      const players = currentGame.teams[curTeamIndex].players;
      const playerIndex = players.findIndex(p => p === name);
      currentGame.teams[curTeamIndex].players = [].concat(players.slice(0, playerIndex), players.slice(playerIndex + 1));
      if (currentGame.teams[curTeamIndex].players.length < 1) {
        currentGame = Object.assign({}, currentGame, {
          teams: [].concat(currentGame.teams.slice(0, curTeamIndex), currentGame.teams.slice(curTeamIndex + 1))
        });
      }
    }
    const audienceIndex = currentGame.audience.findIndex(p => p === name);
    if (audienceIndex >= 0) {
      currentGame = Object.assign({}, currentGame, {
        audience: [].concat(currentGame.audience.slice(0, audienceIndex), currentGame.audience.slice(audienceIndex + 1))
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

const startGame = (server, { game }) => {
  const currentGame = getCurrentGame(server, game);
  if (currentGame.isStarted) {
    throw new GameError('Game already started');
  }
  if (currentGame.teams.length < 2) {
    throw new GameError('At least 2 teams are needed to start the game');
  }
  for (const team of currentGame.teams) {
    if (team.players.length < 2) {
      throw new GameError('All teams need at least 2 players');
    }
  }

  const isDev = process.env.NODE_ENV === 'development';
  const firstTeamIndex = isDev ? 0 : Math.floor(Math.random() * currentGame.teams.length);
  const firstPlayer = isDev ? currentGame.teams[firstTeamIndex].players[0] : getRandomElement(currentGame.teams[firstTeamIndex].players);
  currentGame.teams[firstTeamIndex].curPlayer = firstPlayer;
  if (currentGame.roundInterval) {
    clearInterval(currentGame.roundInterval);
  }
  console.debug('Starting Game', currentGame);
  return Object.assign({}, currentGame, {
    curTeam: firstTeamIndex
  });
};

const startRoundInterval = (server, game) => (
  setInterval(() => {
    let currentGame = getCurrentGame(server, game);
    const timeLeft = currentGame.roundEnd - Date.now();
    if (timeLeft < 1) {
      clearInterval(currentGame.roundInterval);
      currentGame.teams[currentGame.curTeam].skipped = [].concat(currentGame.teams[currentGame.curTeam].skipped, currentGame.card.index);
      const nextIndex = currentGame.curTeam + 1 >= currentGame.teams.length ? 0 : currentGame.curTeam + 1;
      const nextTeam = currentGame.teams[nextIndex];
      if (nextTeam.curPlayer) {
        nextTeam.curPlayer = getNextElement(nextTeam.players, nextTeam.players.findIndex(player => player === nextTeam.curPlayer));
      } else {
        nextTeam.curPlayer = getRandomElement(nextTeam.players);
      }
      const { card, roundEnd, ...rest } = currentGame;
      server.updateGameState(game, Object.assign({}, rest, {
        curTeam: nextIndex
      }));
      server.broadcast(game, { type: 'END_ROUND' });
    }
  }, 500)
);

const startRound = (server, { game, name }) => {
  const currentGame = getCurrentGame(server, game);
  if (!currentGame.isStarted) {
    throw new GameError('Game is not started yet');
  }
  const { curPlayer } = currentGame.teams[currentGame.curTeam];
  if (name !== curPlayer) {
    new GameError('Not your turn');
  }
  console.debug('Starting round', currentGame);
  return Object.assign({}, currentGame, {
    roundEnd: Date.now() + (game === 'test' ? (15 * 1000) : LENGTH_OF_ROUND),
    card: drawCard(server.cards, currentGame),
    roundInterval: startRoundInterval(server, game)
  });
};

const buzz = (server, { game, name, team }) => {
  const currentGame = getCurrentGame(server, game);
  if (!currentGame.isStarted) {
    throw new GameError('Game is not started yet');
  }
  if (!currentGame.isRoundStarted) {
    throw new GameError('Cannot buzz before round starts');
  }
  if (currentGame.teams[currentGame.curTeam].name === team) {
    throw new GameError('Cannot buzz your own team');
  }
  if (!team) {
    throw new GameError('Cannot buzz from the audience');
  }
  clearInterval(currentGame.roundInterval);
  const { roundEnd, ...rest } = currentGame;
  return Object.assign({}, rest, {
    buzzer: name,
    timeLeft: currentGame.roundEnd - Date.now()
  });
};

const buzzContinue = (server, isValid, { game, name }) => {
  const currentGame = getCurrentGame(server, game);
  if (!currentGame.isStarted) {
    throw new GameError('Game is not started');
  }
  if (!currentGame.buzzer) {
    throw new GameError('Cannot continue before being buzzed');
  }
  const curTeam = currentGame.teams[currentGame.curTeam];
  if (name !== curTeam.curPlayer) {
    throw new GameError('Not your turn');
  }
  if (isValid) {
    curTeam.skipped = [].concat(curTeam.skipped, currentGame.card.index);
  }
  const { buzzer, timeLeft, ...rest } = currentGame;
  return Object.assign({}, rest, {
    roundEnd: Date.now() + currentGame.timeLeft,
    roundInterval: startRoundInterval(server, game),
    card: isValid ? drawCard(server.cards, currentGame) : currentGame.card,
    lastCard: isValid ? currentGame.card.word : currentGame.lastCard
  });
};

const nextCard = (server, cardList, { game, name }) => {
  const currentGame = getCurrentGame(server, game);
  if (!currentGame.isStarted) {
    throw new GameError('Game is not started yet');
  }
  const { curPlayer } = currentGame.teams[currentGame.curTeam];
  if (name !== curPlayer) {
    throw new GameError('Not your turn');
  }
  const curTeam = currentGame.teams[currentGame.curTeam];
  curTeam[cardList] = curTeam[cardList].concat(currentGame.card.index);
  return Object.assign({}, currentGame, {
    card: drawCard(server.cards, currentGame),
    lastCard: currentGame.card ? currentGame.card.word : undefined
  });
};

const endGame = (server, { game }) => {
  const currentGame = getCurrentGame(server, game);
  if (!currentGame.isStarted) {
    throw new GameError('Game is not started yet');
  }
  return {
    teams: currentGame.teams.map(({ name, players }) => ({
      name,
      players,
      correct: [],
      skipped: []
    })),
    players: currentGame.players,
    gameResults: currentGame.teams.map(team => ({
      name: team.name,
      players: team.players,
      skipped: team.skipped.map(id => server.cards.find(card => card.index === id).word),
      correct: team.correct.map(id => server.cards.find(card => card.index === id).word)
    })),
    audience: []
  };
};

module.exports = {
  addPlayer,
  changeTeam,
  leaveGame,
  startGame,
  startRound,
  buzz,
  buzzContinue,
  nextCard,
  endGame
};
