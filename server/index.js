import "dotenv/config";
import express from "express";
import http from "node:http";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { Server as SocketServer } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.WEB_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173").split(",").map((v) => v.trim());
const io = new SocketServer(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] }
});
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to a random value at least 32 characters long.");
}

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "32kb" }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
const messageLimiter = rateLimit({ windowMs: 60 * 1000, limit: 40, standardHeaders: "draft-8", legacyHeaders: false });

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d", issuer: "connectx" });
}

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Sign in to continue." });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: "connectx" });
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, username: true, email: true } });
    if (!user) return res.status(401).json({ error: "Account not found." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
  }
}

async function isMember(userId, spaceId) {
  return Boolean(await prisma.membership.findUnique({ where: { userId_spaceId: { userId, spaceId } } }));
}

async function channelAccess(userId, channelId) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, name: true, topic: true, spaceId: true } });
  if (!channel || !(await isMember(userId, channel.spaceId))) return null;
  return channel;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "connectx-api" }));

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const parsed = z.object({
    username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only."),
    email: z.string().trim().email().max(254),
    password: z.string().min(10).max(72)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid account details." });

  const username = parsed.data.username;
  const email = parsed.data.email.toLowerCase();
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({ data: { username, email, passwordHash } });
    const space = await prisma.space.findFirst({ orderBy: { createdAt: "asc" } });
    if (space) await prisma.membership.create({ data: { userId: user.id, spaceId: space.id } });
    const safeUser = { id: user.id, username: user.username, email: user.email };
    res.status(201).json({ token: signToken(user), user: safeUser });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: "That username or email is already registered." });
    console.error("Registration failed:", error);
    res.status(500).json({ error: "Could not create your account." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const parsed = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password." });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  res.json({ token: signToken(user), user: { id: user.id, username: user.username, email: user.email } });
});

app.get("/api/me", authenticate, (req, res) => res.json({ user: req.user }));

app.get("/api/spaces", authenticate, async (req, res) => {
  const spaces = await prisma.space.findMany({
    where: { memberships: { some: { userId: req.user.id } } },
    select: { id: true, name: true, description: true, channels: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, topic: true } } }
  });
  res.json({ spaces });
});

app.get("/api/spaces/:spaceId/channels", authenticate, async (req, res) => {
  if (!(await isMember(req.user.id, req.params.spaceId))) return res.status(403).json({ error: "You are not a member of this space." });
  const channels = await prisma.channel.findMany({ where: { spaceId: req.params.spaceId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, topic: true } });
  res.json({ channels });
});

app.get("/api/channels/:channelId/messages", authenticate, async (req, res) => {
  const channel = await channelAccess(req.user.id, req.params.channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found." });
  const messages = await prisma.message.findMany({
    where: { channelId: channel.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { id: true, username: true } } }
  });
  res.json({ messages: messages.reverse() });
});

app.post("/api/channels/:channelId/messages", authenticate, messageLimiter, async (req, res) => {
  const parsed = z.object({ content: z.string().trim().min(1).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Messages must contain between 1 and 2,000 characters." });
  const channel = await channelAccess(req.user.id, req.params.channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found." });
  const message = await prisma.message.create({
    data: { channelId: channel.id, authorId: req.user.id, content: parsed.data.content },
    include: { author: { select: { id: true, username: true } } }
  });
  io.to(channel.id).emit("message:new", message);
  res.status(201).json({ message });
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, JWT_SECRET, { issuer: "connectx" });
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, username: true } });
    if (!user) return next(new Error("Unauthorized"));
    socket.user = user;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.on("channel:join", async (channelId) => {
    if (typeof channelId !== "string" || channelId.length > 64) return;
    const channel = await channelAccess(socket.user.id, channelId);
    if (channel) socket.join(channel.id);
  });
  socket.on("channel:leave", (channelId) => {
    if (typeof channelId === "string") socket.leave(channelId);
  });
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled API error:", error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

server.listen(PORT, "0.0.0.0", () => console.log(`ConnectX API listening on port ${PORT}`));

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);