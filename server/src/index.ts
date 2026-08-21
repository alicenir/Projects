import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items.js";
import { settingsRouter } from "./routes/settings.js";
import { sabnzbdRouter } from "./routes/sabnzbd.js";
import { getSnapshot, startSabnzbdPolling } from "./services/sabnzbd.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5000);
const CLIENT_DIST = process.env.CLIENT_DIST ?? path.join(__dirname, "../public");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? true, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api", itemsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/sabnzbd", sabnzbdRouter);

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN ?? true, credentials: true },
});

io.on("connection", async (socket) => {
  socket.emit("sabnzbd:update", await getSnapshot());
});

startSabnzbdPolling(io);

httpServer.listen(PORT, () => {
  console.log(`Homebase server listening on port ${PORT}`);
});
