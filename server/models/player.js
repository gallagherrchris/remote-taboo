import sequelize, { Sequelize } from '../lib/db';

const Player = sequelize.define('player', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  game_id: {
    type: Sequelize.STRING,
    references: {
      model: 'game',
      key: 'id'
    }
  },
});

export default Player;
