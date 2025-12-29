/**
 * Intentionally vulnerable demo app.
 * DO NOT DEPLOY. Localhost only.
 */

const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const _ = require("lodash");     // version volontairement ancienne
const minimist = require("minimist"); // version volontairement ancienne

const { db, init } = require("./db");
init();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ⚠️ Secret hardcodé (mauvaise pratique)
const APP_SECRET = "SUPER_SECRET_HARDCODED_KEY";

// Page d'accueil
app.get("/", (req, res) => {
  res.type("html").send(`
    <h2>Intentionally Vulnerable Demo</h2>
    <ul>
      <li>/search?u=alice</li>
      <li>/echo?msg=hello</li>
      <li>/ping?host=127.0.0.1</li>
      <li>/read?file=hello.txt</li>
      <li>POST /login (username, password)</li>
      <li>/config</li>
    </ul>
  `);
});

/**
 * 1) SQL Injection (concaténation de chaîne)
 * Exemple: recherche utilisateur via paramètre `u`
 */
app.get("/search", (req, res) => {
  const u = req.query.u || "";
  const query = "SELECT id, username FROM users WHERE username = '" + u + "'"; // ⚠️ SQLi
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.json({ query, rows });
  });
});

/**
 * 2) Reflected XSS (aucun échappement)
 */
app.get("/echo", (req, res) => {
  const msg = req.query.msg || "";
  res.type("html").send(`<h1>Echo:</h1><div>${msg}</div>`); // ⚠️ XSS
});

/**
 * 3) Command Injection (exécution shell avec input user)
 */
app.get("/ping", (req, res) => {
  const host = req.query.host || "127.0.0.1";
  exec(`ping -c 1 ${host}`, { timeout: 3000 }, (err, stdout, stderr) => { // ⚠️ command injection
    res.type("text").send([stdout, stderr, err ? String(err) : ""].join("\n"));
  });
});

/**
 * 4) Path Traversal (join sans validation)
 * Lit un fichier depuis ./files/
 */
app.get("/read", (req, res) => {
  const file = req.query.file || "hello.txt";
  const target = path.join(__dirname, "files", file); // ⚠️ traversal possible
  fs.readFile(target, "utf8", (err, data) => {
    if (err) return res.status(404).send("Not found");
    res.type("text").send(data);
  });
});

/**
 * 5) Auth faible + fuite d'infos (mauvaises pratiques)
 * - mot de passe en clair
 * - erreurs verbeuses
 */
app.post("/login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");

  // ⚠️ SQLi + comparaison de mot de passe en clair
  const query =
    "SELECT id, username FROM users WHERE username = '" +
    username +
    "' AND password = '" +
    password +
    "'";

  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: String(err), query });
    if (!rows.length) return res.status(401).json({ ok: false, message: "Invalid credentials", query });
    res.json({ ok: true, user: rows[0], secretLeaked: APP_SECRET }); // ⚠️ fuite
  });
});

/**
 * 6) Prototype pollution style bug (pattern volontairement risqué)
 * Fusion d'objets user-controlled sans garde-fou.
 */
app.post("/merge", (req, res) => {
  const base = { theme: { dark: false } };
  const userObj = req.body || {};
  const merged = _.merge({}, base, userObj); // ⚠️ merge non contrôlé
  res.json({ merged });
});

/**
 * 7) Exposition de config sensible
 */
app.get("/config", (req, res) => {
  // ⚠️ expose des infos sensibles
  res.json({
    env: process.env.NODE_ENV || "dev",
    secret: APP_SECRET,
    note: "This endpoint should never exist in real apps."
  });
});

// ⚠️ écoute en local uniquement
const PORT = process.env.PORT || 3000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Vulnerable demo listening on http://127.0.0.1:${PORT}`);
});
