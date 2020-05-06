import sequelize, { Sequelize } from '../lib/db';

const Game = sequelize.define('game', {
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

export default Game;
