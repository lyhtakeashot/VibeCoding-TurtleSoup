import { io, type Socket } from 'socket.io-client';

let socketSingleton: Socket | null = null;

export function getSocket(): Socket {
  if (!socketSingleton) {
    socketSingleton = io({ autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socketSingleton;
}
