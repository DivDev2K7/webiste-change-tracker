const clients = new Set();

export function broadcast(event, payload) {
  const message = JSON.stringify({ event, payload });
  for (const client of clients) {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch {
        clients.delete(client);
      }
    }
    else clients.delete(client);
  }
}

export function registerClient(ws) {
  clients.add(ws);
  ws.once('close', () => clients.delete(ws));
  ws.once('error', () => clients.delete(ws));
}
