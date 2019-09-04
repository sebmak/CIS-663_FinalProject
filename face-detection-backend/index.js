var WebSocketServer = require('websocket').server;
var http = require('http');
const { promisify } = require('util');
const fs = require('fs');
const { match, train } = require('./model.js');
const bcrypt = require('bcryptjs');
const path = require('path');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

var server = http.createServer(async (req, res) => {
  let file = '';
  try {
    file = await readFile(path.resolve(`./ui${req.url}`))
  } catch (e) {
    file = await readFile(path.resolve('./ui/index.html'))
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(file);
});
server.listen(1337, function() {
  console.log("Started");
});

// create the server
wsServer = new WebSocketServer({
  httpServer: server
});

const doTrain = async (body) => {
  body.data = body.data.replace(/^data:image\/jpeg;base64,/, "")

  await writeFile(`./out/${body.username}-${body.index}.jpg`, body.data, 'base64');

  train(body.username, body.index)
}

const register = async (body) => {
  await writeFile(`./accounts/${body.username}`, body.password, 'utf8');
}

const getMatch = async (body) => {
  body.data = body.data.replace(/^data:image\/jpeg;base64,/, "")
  const result = await match(body.data)

  return JSON.stringify({
    path: '/match',
    data: result
  })
}

const getAuthAttempt = async ({ username, password }) => {
  let error = '';
  let match = false;
  try {
    const encPassword = await readFile(`./accounts/${username}`, 'utf8');
    match = encPassword&&password && bcrypt.compareSync(password, encPassword);

    if (!match) {
      error = 'Password not correct for matched account!'
    }
  } catch (e) {
    console.error(e);
    error = e
  }

  return JSON.stringify({
    path: '/auth-attempt',
    success: match,
    error: error
  })
}

// WebSocket server
wsServer.on('request', function(request) {
  var connection = request.accept(null, request.origin);

  // This is the most important callback for us, we'll handle
  // all messages from users here.
  connection.on('message', async (message) => {
    try {
      const body = JSON.parse(message.utf8Data);

      switch (body.path) {
        case '/train':
          return doTrain(body)
        case '/register':
          return register(body)
        case '/auth-attempt':
          connection.sendUTF(await getAuthAttempt(body))
          return
        case '/match':
          connection.sendUTF(await getMatch(body))
          return
        default:
          console.log("Unknown path")
      }

    } catch (e) {
      console.error(e);
    }
  });

  connection.on('close', function(connection) {
    // close user connection
  });
});
