import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { sanitizeMiddleware } from './middleware/sanitize.js';
import hpp from 'hpp';
import jwt from 'jsonwebtoken';
import { normalizeRole } from '@mmp/shared';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { initSentry, sentryErrorHandler } from './config/sentry.js';
import rateLimit from 'express-rate-limit';

import statusRoutes from './modules/status/routes.js';
import authRoutes from './modules/auth/routes.js';
import accessRoutes from './modules/access/routes.js';
import userRoutes from './modules/users/routes.js';
import peopleRoutes from './modules/people/routes.js';
import referenceRoutes from './modules/referenceData/routes.js';
import departmentRoutes from './modules/departments/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import calendarRoutes from './modules/calendar/routes.js';
import uploadRoutes from './modules/uploads/routes.js';
import reportRoutes from './modules/reports/routes.js';
import dashboardRoutes from './modules/reports/dashboard.routes.js';
import docsRoutes from './modules/docs/routes.js';
import targetRoutes from './modules/targets/routes.js';
import campaignRoutes from './modules/campaigns/routes.js';
import workItemRoutes from './modules/workItems/routes.js';
import assignmentRoutes from './modules/assignment/routes.js';
import * as assignmentController from './modules/assignment/controller.js';
import { feedbackRouter, revisionsRouter } from './modules/feedback/routes.js';
import blockerRoutes from './modules/blockers/routes.js';
import { authenticate } from './middleware/auth.js';
import { initQueues } from './lib/queue.js';
import { initDomainEventListeners } from './modules/notifications/service.js';

const app = express();
const server = http.createServer(app);

// Initialize Observability
initSentry(app);

// 1. Request Correlation ID
app.use(requestIdMiddleware);

// 2. Trust proxy for Render / Vercel proxy headers
app.set('trust proxy', 1);

// 2. Security headers
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

// 3. CORS configuration
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// 4. Request parsing & Sanitization
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(sanitizeMiddleware);
app.use(hpp());

// General API rate limiter for production environments
if (env.NODE_ENV === 'production') {
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1500,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP. Please try again after 15 minutes.',
        },
      },
    })
  );
}

// 5. Socket.io setup
export const io = new SocketIOServer(server, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    let token = null;

    if (cookieHeader) {
      const match = cookieHeader.match(/accessToken=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token && socket.handshake.query?.token) {
      token = socket.handshake.query.token;
    }

    if (!token && socket.handshake.headers.authorization) {
      const parts = socket.handshake.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded.role) {
        decoded.role = normalizeRole(decoded.role);
      }
      socket.user = decoded;
      return next();
    }
    // Allow unauthenticated connection or proceed
    next();
  } catch (err) {
    logger.warn({ err: err.message }, 'Socket.io authentication warning');
    next();
  }
});

io.on('connection', (socket) => {
  if (socket.user?.userId) {
    socket.join(`user:${socket.user.userId}`);
    logger.debug(`Socket joined personal room: user:${socket.user.userId}`);

    if (socket.user.role) {
      const normalizedRole = normalizeRole(socket.user.role);
      socket.join(`role:${normalizedRole}`);
    }
  }
});

// 6. API Routes
app.use('/api', statusRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/access-requests', accessRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/reference-data', referenceRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/uploads', uploadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/work', workItemRoutes);
app.use('/api/my-work', (req, res, next) => {
  req.url = '/my-work' + (req.url === '/' ? '' : req.url);
  workItemRoutes(req, res, next);
});
app.use('/api/todo', (req, res, next) => {
  req.url = '/todo' + (req.url === '/' ? '' : req.url);
  workItemRoutes(req, res, next);
});
app.use('/api/assignment', assignmentRoutes);
app.use('/api/workload', authenticate, assignmentController.getTeamWorkload);
app.use('/api/feedback', feedbackRouter);
app.use('/api/revisions', revisionsRouter);
app.use('/api/blockers', blockerRoutes);

app.set('io', io);

// 7. 404 Handler
app.use((req, res) => {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `The requested path ${req.originalUrl} does not exist.`,
    },
  });
});

// 8. Error Handling & Observability
app.use(sentryErrorHandler);
app.use(errorHandler);

// 9. Startup & Database
export async function startServer() {
  await connectDB();
  await initQueues();
  initDomainEventListeners(io);

  return new Promise((resolve) => {
    server.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 API Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`🔗 Health check available at http://localhost:${env.PORT}/api/status`);
      resolve(server);
    });
  });
}

// Automatically start if called directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  });
}

export { app, server };
