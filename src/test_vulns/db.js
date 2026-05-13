// SQL concatenation -> SQL injection risk
const db = require("some-db-client");
module.exports.getUser = async function (username) {
  const sql = "SELECT * FROM users WHERE username = '" + username + "';"; // unsafe concat
  const rows = await db.query(sql);
  return rows[0];
};
