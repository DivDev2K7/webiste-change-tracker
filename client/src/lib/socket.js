const subscribers = new Map();
let socket;
let reconnectTimer;

function connect() {
  if (socket || subscribers.size === 0) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const activeSocket = new WebSocket(`${protocol}//${window.location.host}/ws`);
  socket = activeSocket;

  activeSocket.addEventListener('message', (message) => {
    let data;
    try {
      data = JSON.parse(message.data);
    } catch {
      return;
    }
    for (const handler of subscribers.get(data.event) || []) handler(data.payload);
  });

  activeSocket.addEventListener('close', () => {
    if (socket === activeSocket) socket = null;
    if (subscribers.size) reconnectTimer = window.setTimeout(connect, 3000);
  });
  activeSocket.addEventListener('error', () => activeSocket.close());
}

export function subscribe(event, handler) {
  if (!subscribers.has(event)) subscribers.set(event, new Set());
  subscribers.get(event).add(handler);
  connect();

  return () => {
    const handlers = subscribers.get(event);
    handlers?.delete(handler);
    if (handlers?.size === 0) subscribers.delete(event);
    if (subscribers.size === 0) {
      window.clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
    }
  };
}
