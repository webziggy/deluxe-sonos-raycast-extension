const ha = require('home-assistant-js-websocket');
const WebSocket = require('ws');

const auth = ha.createLongLivedTokenAuth(
  "https://j1nv12sclnesq7pa0qktyeepseyswnwj.ui.nabu.casa",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3NWIzYjA0Y2MzZjY0YTg0OTk4NzQ3NDAyNDk0NjAxNSIsImlhdCI6MTc4NzkxNzU2NywiZXhwIjoyMTAzMjc3NTY3fQ.qoiPREZGNe4Z1nTBAA5QcRK9IwjP0GtboJjqJGzPl5k"
);

console.log("URL:", auth.wsUrl);

ha.createConnection({
  auth,
  createSocket: async () => {
    const ws = new WebSocket(auth.wsUrl);
    return ws;
  }
}).then(conn => {
  console.log("Connected!");
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
