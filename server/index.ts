import { createServer } from "http";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import { initSocketServer } from "../app/lib/socket.server";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});

const app = express();
app.use(express.static("build/client"));

app.all(
  "/{*splat}",
  createRequestHandler({
    build: () => import("../build/server/index.js"),
  }),
);

const httpServer = createServer(app);

try {
  initSocketServer(httpServer);
} catch (err) {
  console.error("initSocketServer failed:", err);
  process.exit(1);
}

const hostname = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";
const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});