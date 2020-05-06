import sequelize, { Sequelize} from '../lib/db';

const Card = sequelize.define('card', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  word: {
    type: Sequelize.STRING
  },
  taboo: {
    type: Sequelize.STRING
  }
});

export default Card;
