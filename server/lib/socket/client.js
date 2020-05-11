const gameUtils = require('../game');
const GameError = require('../gameError');

const handleMessage = (socket, message) => {
  try {
    const event = JSON.parse(message);

    if (!socket.gameData && event.type !== 'JOIN_GAME') {
      socket.sendError('You must join a game first');
      return;
    }
    const { server } = socket;
    let newGameState;

    switch (event.type) {
      case 'JOIN_GAME':
        newGameState = gameUtils.addPlayer(server, event.data.game, event.data.name);
        socket.gameData = { game: event.data.game, name: event.data.name };
        socket.sendSuccess(`Registered as ${event.data.name}`);
        break;
      case 'CHANGE_TEAM':
        newGameState = gameUtils.changeTeam(server, event.data, socket.gameData);
        socket.gameData = Object.assign({}, socket.gameData, {
          team: event.data
        });
        socket.sendSuccess(`Joined team ${event.data}`)
        break;
      case 'START_GAME':
        newGameState = gameUtils.startGame(server, socket.gameData);
        break;
      case 'START_ROUND':
        newGameState = gameUtils.startRound(server, socket.gameData);
        break;
      case 'SKIP':
      case 'CORRECT':
        newGameState = gameUtils.nextCard(server, event.type === 'CORRECT' ? 'correct':'skipped', socket.gameData);
        break;
      case 'BUZZ':
        newGameState = gameUtils.buzz(server, socket.gameData);
        server.broadcast(socket.gameData.game, { type: 'BUZZ', data: { buzzer: newGameState.buzzer } });
        break;
      case 'BUZZ_INVALID':
      case 'BUZZ_VALID':
        newGameState = gameUtils.buzzContinue(server, event.type.contains('VALID'), socket.gameData);
        server.broadcast(socket.gameData.game, { type: 'CONTINUE' });
        break;
      case 'END_GAME':
        newGameState = gameUtils.endGame(server, socket.gameData);
        server.broadcast(socket.gameData.game, { type: 'END_GAME' });
        break;
      default:
        console.debug('Unknown TYPE', event.type);
        socket.sendError(`Unknown TYPE:${event.type}`);
        return;
    }
    server.updateGameState(socket.gameData.game, newGameState);
  } catch (error) {
    if (error instanceof GameError) {
      if (error.message === 'Out of cards') {
        socket.server.updateGameState(socket.gameData.game, gameUtils.endGame(socket.server, socket.gameData));
        socket.server.broadcast(socket.gameData.game, { type: 'OUT_OF_CARDS' });
        return;
      }
      socket.sendError(error.message);
    } else {
      console.error(error);
    }
  }
};

const handleClose = (socket) => {
  if (!socket.hasOwnProperty('gameData')) {
    return;
  }
  const newGameState = gameUtils.leaveGame(socket.server, socket.gameData);
  if (!newGameState) {
    const { [socket.gameData.game]: _, ...rest } = socket.server.games;
    socket.server.games = rest;
    return;
  }
  socket.server.updateGameState(socket.gameData.game, newGameState);
};

module.exports = {
  handleMessage,
  handleClose
};
