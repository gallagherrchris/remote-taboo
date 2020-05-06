const db = require('../lib/db');
const { Sequelize } = db;

const Game = db.define('game', {
  id: {
    type: Sequelize.STRING,
    allowNull: false,
    primaryKey: true
  },
  state: {
    type: Sequelize.ENUM,
    values: ['CREATED', 'WAITING_FOR_PLAYERS', 'STARTING', 'ONGOING', 'COMPLETED']
  }
});

module.exports = Game;
