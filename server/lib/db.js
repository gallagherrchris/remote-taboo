const Sequelize = require('sequelize');

const singleton = new Sequelize('postgres://user:pass@example.com:5432/dbname');
singleton.Sequelize = Sequelize;

export { Sequelize, singleton as default };
