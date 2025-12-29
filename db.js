const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database(":memory:");

function init() {
  db.serialize(() => {
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)");
    db.run("INSERT INTO users(username, password) VALUES ('alice', 'password123')");
    db.run("INSERT INTO users(username, password) VALUES ('bob', 'qwerty')");
  });
}

module.exports = { db, init };
