/**
 * Custom Next.js + Socket.IO server (local / VM).
 * Usage: node --experimental-strip-types server.mjs
 * Vercel serverless cannot host Socket.IO — polling remains the fallback.
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end("internal error");
    }
  });

  const io = new Server(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: { origin: true, credentials: true },
  });

  globalThis.__rosIo = io;

  io.on("connection", (socket) => {
    socket.on("join", (payload) => {
      const restaurantId = payload?.restaurantId;
      const branchId = payload?.branchId;
      if (!restaurantId || !branchId) return;
      socket.join(`tenant:${restaurantId}:branch:${branchId}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> RestaurantOS ready on http://${hostname}:${port} (Socket.IO)`);
  });
});
