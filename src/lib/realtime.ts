/**
 * Minimal Socket.IO bus for RestaurantOS (local/custom Node server).
 * On serverless (Vercel) emits are no-ops; clients keep polling as fallback.
 */

type Emitter = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
  emit: (event: string, payload: unknown) => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __rosIo: Emitter | undefined;
}

export function setSocketServer(io: Emitter) {
  globalThis.__rosIo = io;
}

export function getSocketServer(): Emitter | null {
  return globalThis.__rosIo ?? null;
}

export function emitBranchEvent(
  restaurantId: string,
  branchId: string,
  event: string,
  payload: unknown
) {
  const io = getSocketServer();
  if (!io) return;
  const room = `tenant:${restaurantId}:branch:${branchId}`;
  io.to(room).emit(event, payload);
}
