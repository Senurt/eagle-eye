const express = require('express');
const mysql = require('mysql2');
const admin = require('firebase-admin');
const app = express();

app.use(express.json());

// 1. INITIALIZE FIREBASE (Using the OpenShift Secret path)
const serviceAccount = require("/etc/secrets/service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://dronethesis-745cf-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

// 2. INITIALIZE MYSQL (Using Environment Variables)
const sqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: 'eagle_eye_db'
});

// 3. EXAMPLE ROUTE: Sync a new user from Web -> MySQL -> Firebase
app.post('/signup', (req, res) => {
  const { username, email } = req.body;

  // Save to MySQL first
  sqlPool.query('INSERT INTO users (username, email) VALUES (?, ?)', [username, email], (err) => {
    if (err) return res.status(500).send(err);

    // Then Sync to Firebase for real-time tracking
    db.collection('active_missions').doc(username).set({
      email: email,
      status: 'online',
      last_seen: new Date().toISOString()
    });

    res.send("User synced across SQL and Firebase!");
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Eagle Eye Mediator running on port ${PORT}`));