const ha = require('home-assistant-js-websocket');
const WebSocket = require('ws');
global.WebSocket = WebSocket;
const auth = ha.createLongLivedTokenAuth("http://localhost:8123", "token");
console.log(auth.wsUrl);
