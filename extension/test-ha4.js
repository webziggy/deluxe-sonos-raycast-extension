const WebSocket = require('ws');

const ws = new WebSocket("wss://j1nv12sclnesq7pa0qktyeepseyswnwj.ui.nabu.casa/api/websocket");
ws.on('open', () => {
  console.log("WS Open");
});
ws.on('message', (data) => {
  console.log("Received:", data.toString());
  const msg = JSON.parse(data);
  if (msg.type === 'auth_required') {
    ws.send(JSON.stringify({
      type: "auth",
      access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3NWIzYjA0Y2MzZjY0YTg0OTk4NzQ3NDAyNDk0NjAxNSIsImlhdCI6MTc4NzkxNzU2NywiZXhwIjoyMTAzMjc3NTY3fQ.qoiPREZGNe4Z1nTBAA5QcRK9IwjP0GtboJjqJGzPl5k"
    }));
  } else if (msg.type === 'auth_ok') {
    process.exit(0);
  }
});
