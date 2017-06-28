'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({origin: true});

const EMAIL = 'admin@game.prisoner';
admin.initializeApp(functions.config().firebase);
const app = express();
const validateFirebaseIdToken = (req, res, next) => {
  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !req.cookies.__session) {
    res.status(403).send('Unauthorized');
    return;
  }
  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else {
    idToken = req.cookies.__session;
  }
  admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
    req.user = decodedIdToken;
    next();
  }).catch(error => {
    res.status(403).send('Unauthorized');
  });
};
const shuffle = (array) => {
  const shuffled = [...array];
  let m = shuffled.length;
  let t;
  let i;
  while (m !== 0) {
    m -= 1;
    i = Math.floor(Math.random() * m);
    t = shuffled[m];
    shuffled[m] = array[i];
    shuffled[i] = t;
  }
  return shuffled;
};
app.use(cors);
app.use(cookieParser);
app.use(validateFirebaseIdToken);
app.get('/round', (req, res) => {
  if (req.user.email !== EMAIL) {
    res.status(403).send('Unauthorized');
    return;
  }
  // TODO: WORRY ABOUT EMPTY
  // TODO: WORRY ABOUT ODD
  // TODO: WORRY ABOUT DROPOUT
  // TODO: WORRY ABOUT MISSING SELECTIONS
  admin.database().ref('gameState').set('STARTING').then(() => {
    admin.database().ref('joined').once('value')
    .then((snap) => {
      const resetCommands = [];
      const joinedKeys = Object.keys(snap.val());
      resetCommands.push(admin.database().ref('selection').remove());
      resetCommands.push(admin.database().ref('messages').remove());
      admin.database().ref('paired').remove().then(() => {
        for (let i = 0; i < joinedKeys.length; i += 2) {
          const joinedKey = joinedKeys[i];
          const nextJoinedKey = joinedKeys[i + 1];
          resetCommands.push(admin.database().ref(`paired/${joinedKey}`).set(nextJoinedKey));
          resetCommands.push(admin.database().ref(`paired/${nextJoinedKey}`).set(joinedKey));
        }
        Promise.all(resetCommands).then(() => admin.database().ref('gameState').set('DISCUSSING').then(() => res.send({})));
      }); // PAIRED REMOVE
    }); // GET JOINED
  }); // GAMESTATE UPDATE
});
app.get('/score', (req, res) => {
  if (req.user.email !== EMAIL) {
    res.status(403).send('Unauthorized');
    return;
  }
  // TODO: VALIDATE WHICH USER
  // TODO: WORRY ABOUT EMPTY
  // TODO: WORRY ABOUT ODD
  // TODO: WORRY ABOUT DROPOUT
  // TODO: WORRY ABOUT MISSING SELECTIONS
  // GET SCORING PARAMETERS
  const commands = [];
  // AMOUNT
  commands.push(admin.database().ref('amount').once('value')
  .then((snap) => {
    return snap.val();
  }));
  // OTHER_AMOUNT
  commands.push(admin.database().ref('otherAmount').once('value')
  .then((snap) => {
    return snap.val();
  }));
  // JOINED
  commands.push(admin.database().ref('joined').once('value')
  .then((snap) => {
    return snap.val();
  }));
  // PAIRED
  commands.push(admin.database().ref('paired').once('value')
  .then((snap) => {
    return snap.val();
  }));
  // SELECTION
  commands.push(admin.database().ref('selection').once('value')
  .then((snap) => {
    return snap.val();
  }));
  Promise.all(commands)
  .then(([
    amount,
    otherAmount,
    joined,
    paired,
    selection
  ]) => {
    let cooperate = 0;
    let not = 0;
    const setScoreCommands = [];
    const joinedKeys = Object.keys(joined);
    // UPDATE SCORES
    for (let i = 0; i < joinedKeys.length; i += 1) {
      const joinedKey = joinedKeys[i];
      let score = joined[joinedKey];
      if (!selection[joinedKey]) {
        score += amount;
        not += 1;
      } else {
        cooperate += 1;
      }
      if (selection[paired[joinedKey]]) score += otherAmount;
      setScoreCommands.push(admin.database().ref(`joined/${joinedKey}`).set(score));
    }
    // RECORD ROUND
    setScoreCommands.push(admin.database().ref('rounds').push({
      amount,
      otherAmount,
      cooperate,
      not,
    }));
    Promise.all(setScoreCommands).then(() => admin.database().ref('gameState').set('SCORE').then(() => res.send({})));
  });
});
app.get('/game', (req, res) => {
  if (req.user.email !== EMAIL) {
    res.status(403).send('Unauthorized');
    return;
  }
  const setCommands = [];
  setCommands.push(admin.database().ref('selection').remove());
  setCommands.push(admin.database().ref('messages').remove());
  setCommands.push(admin.database().ref('paired').remove());
  setCommands.push(admin.database().ref('joined').remove());
  setCommands.push(admin.database().ref('rounds').remove());
  Promise.all(setCommands).then(() => admin.database().ref('gameState').set('JOIN').then(() => res.send({})));
});
exports.app = functions.https.onRequest(app);
