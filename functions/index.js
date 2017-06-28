const functions = require('firebase-functions');
const admin = require('firebase-admin');

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
admin.initializeApp(functions.config().firebase);
// GAME
exports.game = functions.https.onRequest((req, res) => {
  // TODO: WORRY ABOUT PROTECTING FUNCTION
  const setCommands = [];
  setCommands.push(admin.database().ref('selection').remove());
  setCommands.push(admin.database().ref('messages').remove());
  setCommands.push(admin.database().ref('paired').remove());
  setCommands.push(admin.database().ref('joined').remove());
  Promise.all(setCommands).then(() => admin.database().ref('gameState').set('JOIN').then(() => res.send({})));
});
// ROUND
exports.round = functions.https.onRequest((req, res) => {
  // TODO: WORRY ABOUT PROTECTING FUNCTION
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
}); // ENDPOINT
// SCORE
exports.score = functions.https.onRequest((req, res) => {
  // TODO: WORRY ABOUT PROTECTING FUNCTION
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
    const setScoreCommands = [];
    const joinedKeys = Object.keys(joined);
    // UPDATE SCORES
    for (let i = 0; i < joinedKeys.length; i += 1) {
      const joinedKey = joinedKeys[i];
      let score = joined[joinedKey];
      if (!selection[joinedKey]) score += amount;
      if (selection[paired[joinedKey]]) score += otherAmount;
      setScoreCommands.push(admin.database().ref(`joined/${joinedKey}`).set(score));
    }
    Promise.all(setScoreCommands).then(() => admin.database().ref('gameState').set('SCORE').then(() => res.send({})));
  }); // ALL GET PARAMETERS
}); // ENDPOINT
