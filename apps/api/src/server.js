import http from "http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sanitizeMiddleware } from "./middleware/sanitize.js";
import hpp from "hpp";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { normalizeRole } from "@mmp/shared";

const __serverFilename = fileURLToPath(import.meta.url);
const __serverDirname = path.dirname(__serverFilename);
const localUploadsDir = path.resolve(__serverDirname, "../uploads");
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { redactContact } from "./middleware/redactContact.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import rateLimit from "express-rate-limit";

import statusRoutes from "./modules/status/routes.js";
import authRoutes from "./modules/auth/routes.js";
import profileRoutes from "./modules/profile/routes.js";
import accessRoutes from "./modules/access/routes.js";
import peopleRoutes from "./modules/people/routes.js";
import referenceRoutes from "./modules/referenceData/routes.js";
import departmentRoutes from "./modules/departments/routes.js";
import notificationRoutes from "./modules/notifications/routes.js";
import planRoutes from "./modules/calendar/plan.routes.js";
import contentPieceRoutes from "./modules/calendar/contentPiece.routes.js";
import uploadRoutes from "./modules/uploads/routes.js";
import { setUploadHeaders } from "./modules/uploads/fileTypes.js";
import reportRoutes from "./modules/reports/routes.js";
import dashboardRoutes from "./modules/reports/dashboard.routes.js";
import docsRoutes from "./modules/docs/routes.js";
import workItemRoutes from "./modules/workItems/routes.js";
import assignmentRoutes from "./modules/assignment/routes.js";
import * as assignmentController from "./modules/assignment/controller.js";
import { feedbackRouter, revisionsRouter } from "./modules/feedback/routes.js";
import blockerRoutes from "./modules/blockers/routes.js";
import automationRoutes from "./modules/automation/routes.js";
import teamRoutes from "./modules/team/routes.js";
import submissionRoutes, { attachWorkItemSubmissionRoutes } from "./modules/submissions/routes.js";
import clipsRouter, { attachWorkItemMediaRoutes } from "./modules/media/routes.js";
import { chatRouter } from "./modules/chat/routes.js";
import { setupChatSocket, registerChatSocketIO } from "./modules/chat/socket.js";
import { ensureAutomationRules } from "./modules/automation/runner.js";
import { ensureReportDefinitions } from "./modules/reports/service.js";
import { ensureBaselineUsers } from "./modules/people/baselineUsers.js";
import { authenticate } from "./middleware/auth.js";
import { setSocketServer } from "./lib/socketHub.js";
import { User } from "./modules/people/model.js";
import { initQueues } from "./lib/queue.js";
import { initDomainEventListeners } from "./modules/notifications/service.js";

const app = express();
const server = http.createServer(app);

// 1. Request Correlation ID
app.use(requestIdMiddleware);

// 2. Trust proxy for Render / Vercel proxy headers
app.set("trust proxy", 1);

// 2. Security headers
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }),
);

// 3. CORS configuration
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

// 4. Request parsing & Sanitization
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(sanitizeMiddleware);
app.use(hpp());

// General API rate limiter for production environments
if (env.NODE_ENV === "production") {
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1500,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message:
            "Too many requests from this IP. Please try again after 15 minutes.",
        },
      },
    }),
  );
}

// 5. Socket.io setup
export const io = new SocketIOServer(server, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
  },
});
setSocketServer(io);

/** The access token from the handshake: the httpOnly cookie, or an auth field / header. Never the URL. */
function handshakeToken(handshake) {
  const cookieHeader = handshake.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  if (typeof handshake.auth?.token === "string" && handshake.auth.token) return handshake.auth.token;
  const parts = (handshake.headers.authorization || "").split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return null;
}

// Every connection is checked against the user as they are now: they must exist and not be
// suspended, and their role comes from the database, not from the token.
io.use(async (socket, next) => {
  try {
    const token = handshakeToken(socket.handshake);
    if (!token) return next(new Error("Authentication failed: Valid accessToken required"));
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("role status name preferredName").lean();
    if (!user) return next(new Error("Authentication failed: User not found"));
    if (user.status === "suspended") return next(new Error("Authentication failed: Account is suspended"));
    socket.user = {
      userId: String(user._id),
      role: normalizeRole(user.role),
      name: user.preferredName || user.name,
    };
    return next();
  } catch (err) {
    logger.warn({ err: err.message }, "Socket.io authentication error");
    return next(new Error("Authentication failed: Invalid or expired accessToken"));
  }
});

io.on("connection", (socket) => {
  if (socket.user?.userId) {
    socket.join(`user:${socket.user.userId}`);
    logger.debug(`Socket joined personal room: user:${socket.user.userId}`);

    if (socket.user.role) {
      const normalizedRole = normalizeRole(socket.user.role);
      socket.join(`role:${normalizedRole}`);
    }

    setupChatSocket(io, socket);
  }
});
registerChatSocketIO(io);

// 6. API Routes
app.use(redactContact);
app.use("/api", statusRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/me", profileRoutes);
app.use("/me", profileRoutes);
app.use("/api/admin/access-requests", accessRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/people", peopleRoutes);
app.use("/api/users", peopleRoutes);
app.use("/users", peopleRoutes);
app.use("/api/reference-data", referenceRoutes);
app.use("/api/reference", referenceRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/calendar", planRoutes);
app.use("/api/calendar-plans", planRoutes);
app.use("/calendar-plans", planRoutes);
app.use("/api/content-pieces", contentPieceRoutes);
app.use("/content-pieces", contentPieceRoutes);
// Local development and testing only; production files will come from Cloudinary.
// Uploaded files are served so they can never run as a page: see setUploadHeaders.
const serveUploads = express.static(localUploadsDir, {
  index: false,
  dotfiles: "deny",
  setHeaders: setUploadHeaders,
});
app.use("/uploads", serveUploads);
app.use("/api/uploads/files", serveUploads);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/docs", docsRoutes);
attachWorkItemSubmissionRoutes(workItemRoutes);
attachWorkItemMediaRoutes(workItemRoutes);

app.use("/api/clips", clipsRouter);
app.use("/clips", clipsRouter);
app.use("/api/work", workItemRoutes);
app.use("/api/work-items", workItemRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/submissions", submissionRoutes);
app.use("/api/my-work", (req, res, next) => {
  req.url = "/my-work" + (req.url === "/" ? "" : req.url);
  workItemRoutes(req, res, next);
});
app.use("/api/todo", (req, res, next) => {
  req.url = "/todo" + (req.url === "/" ? "" : req.url);
  workItemRoutes(req, res, next);
});
app.use("/api/assignment", assignmentRoutes);
app.use("/api/workload", authenticate, assignmentController.getTeamWorkload);
app.use("/api/feedback", feedbackRouter);
app.use("/api/revisions", revisionsRouter);
app.use("/api/blockers", blockerRoutes);
app.use("/api/automation/rules", automationRoutes);
app.use("/api/automation", automationRoutes);
app.use("/api/chat", chatRouter);
app.use("/chat", chatRouter);

app.set("io", io);

// 7. 404 Handler
app.use((req, res) => {
  return res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `The requested path ${req.originalUrl} does not exist.`,
    },
  });
});

// 8. Error Handling
app.use(errorHandler);

// 9. Startup & Database
export async function startServer() {
  await connectDB();
  await ensureBaselineUsers();
  await initQueues();
  await ensureAutomationRules();
  await ensureReportDefinitions();
  initDomainEventListeners(io);

  return listenWithRetry();
}

/**
 * Bind the HTTP server to env.PORT. If the port is still held by a previous
 * process (e.g. a dev restart that hasn't fully exited yet), keep retrying
 * instead of crashing. Production gives up after a bounded number of tries.
 */
function listenWithRetry() {
  const maxAttempts = env.NODE_ENV === "production" ? 10 : Infinity;
  const retryDelayMs = 1000;

  return new Promise((resolve, reject) => {
    let attempt = 0;

    const onListening = () => {
      server.off("error", onError);
      logger.info(`🚀 API Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`🔗 Health check available at http://localhost:${env.PORT}/api/status`);
      resolve(server);
    };

    const onError = (err) => {
      if (err.code !== "EADDRINUSE" || attempt >= maxAttempts) {
        server.off("listening", onListening);
        server.off("error", onError);
        reject(err);
        return;
      }
      if (attempt === 1 || attempt % 5 === 0) {
        logger.warn(
          `Port ${env.PORT} is busy (EADDRINUSE) — another API process is still running or shutting down. Retrying every ${retryDelayMs / 1000}s (attempt ${attempt})...`,
        );
      }
      setTimeout(tryListen, retryDelayMs);
    };

    const tryListen = () => {
      attempt += 1;
      server.listen(env.PORT, "0.0.0.0");
    };

    server.on("error", onError);
    server.once("listening", onListening);
    tryListen();
  });
}

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}. Closing HTTP server...`);
  // Release the port right away so a restarted process can bind immediately:
  // disconnect Socket.IO clients and drop idle/keep-alive HTTP connections.
  io.close();
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 1500).unref();
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGBREAK", () => shutdown("SIGBREAK")); // Windows console close / Ctrl+Break

// Automatically start if called directly
if (process.env.NODE_ENV !== "test") {
  const tryStart = (attempt = 1) => {
    startServer().catch((err) => {
      logger.error({ err }, "Failed to start server");
      if (env.NODE_ENV === "production") {
        process.exit(1);
      } else {
        logger.info(`Will retry starting API server in 3 seconds (attempt ${attempt})...`);
        setTimeout(() => tryStart(attempt + 1), 3000);
      }
    });
  };
  tryStart();
}

export { app, server };
