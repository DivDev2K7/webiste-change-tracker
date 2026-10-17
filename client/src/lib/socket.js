const subscribers = new Map();
let socket;
let reconnectTimer;

function socketUrl() {
  const configuredUrl = import.meta.env.VITE_WS_URL;
  if (configuredUrl) return configuredUrl;

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (apiBaseUrl) {
    const backend = new URL(apiBaseUrl);
    return `${backend.protocol === 'https:' ? 'wss:' : 'ws:'}//${backend.host}/ws`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function connect() {
  if (socket || subscribers.size === 0) return;
  const activeSocket = new WebSocket(socketUrl());
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
