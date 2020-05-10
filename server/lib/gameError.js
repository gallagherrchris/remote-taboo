function GameError(message) {
  this.name = 'GameError';
  this.message = message || '';
}

GameError.prototype = new Error();

module.exports = GameError;