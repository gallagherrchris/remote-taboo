const db = require('../lib/db');
const { Sequelize } = db;

const Player = db.define('player', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  game_id: {
    type: Sequelize.STRING,
    references: {
      model: 'games',
      key: 'id'
    }
  },
});

module.exports = Player;
