const Sequelize = require('sequelize');

const db = new Sequelize('postgres://user:pass@example.com:5432/dbname');
db.Sequelize = Sequelize;

module.exports = db;
