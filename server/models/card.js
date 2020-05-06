const db = require('../lib/db');
const { Sequelize } = db;

const Card = db.define('card', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  word: {
    type: Sequelize.STRING,
    allowNull: false
  },
  taboo: {
    type: Sequelize.STRING,
    allowNull: false
  }
});

module.exports = Card;
