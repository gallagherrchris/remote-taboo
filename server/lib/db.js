const Sequelize = require('sequelize');

const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  ssl: true,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});
db.Sequelize = Sequelize;

module.exports = db;
