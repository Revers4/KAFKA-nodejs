const Pool = require("pg").Pool;
const config = require("./config");

const pool = new Pool({
  host: config.PG_HOST,
  user: config.PG_USER,
  password: config.PG_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
