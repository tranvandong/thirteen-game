// server/index.ts
import { createServer } from "http";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import { initSocketServer } from "../app/lib/socket.server";

const app = express();
app.use(express.static("build/client"));

app.all(
  "/{*splat}",
  // @ts-ignore — build chưa tồn tại lúc dev, bỏ qua TS check
  createRequestHandler({
    build: () => import("../build/server/index.js"),
  }),
);

const httpServer = createServer(app);
initSocketServer(httpServer);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
