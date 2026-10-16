import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { sanitizeMiddleware } from './middleware/sanitize.js';
import hpp from 'hpp';
import jwt from 'jsonwebtoken';

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
import auditRoutes from './modules/audit/routes.js';
import departmentRoutes from './modules/departments/routes.js';
import teamRoutes from './modules/teams/routes.js';
import masterDataRoutes from './modules/masterData/routes.js';
import requestRoutes from './modules/requests/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import contentRoutes from './modules/content/routes.js';
import taskRoutes from './modules/tasks/routes.js';
import commentRoutes from './modules/comments/routes.js';
import calendarRoutes from './modules/calendar/routes.js';
import shootRoutes from './modules/shoots/routes.js';
import timeRoutes from './modules/time/routes.js';
import leaveRoutes from './modules/leave/routes.js';
import uploadRoutes from './modules/uploads/routes.js';
import deliverableRoutes from './modules/deliverables/routes.js';
import reportRoutes from './modules/reports/routes.js';
import dashboardRoutes from './modules/reports/dashboard.routes.js';
import docsRoutes from './modules/docs/routes.js';
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
      socket.join(`role:${socket.user.role}`);
    }

    const teamKey = socket.user.team || socket.user.teamId;
    if (teamKey) {
      socket.join(`team:${teamKey}`);
    }
  }

  socket.on('join_task', (taskId) => {
    if (taskId) socket.join(`task:${taskId}`);
  });

  socket.on('leave_task', (taskId) => {
    if (taskId) socket.leave(`task:${taskId}`);
  });

  socket.on('join_request', (requestId) => {
    if (requestId) socket.join(`request:${requestId}`);
  });

  socket.on('leave_request', (requestId) => {
    if (requestId) socket.leave(`request:${requestId}`);
  });

  socket.on('task:typing', ({ taskId, isTyping }) => {
    if (taskId) {
      socket.to(`task:${taskId}`).emit('task:typing', {
        userId: socket.user?.userId,
        name: socket.user?.name,
        isTyping,
      });
    }
  });

  socket.on('task:comment', (payload) => {
    if (payload?.taskId) {
      io.to(`task:${payload.taskId}`).emit('task:comment', {
        ...payload,
        userId: socket.user?.userId,
        name: socket.user?.name,
        timestamp: new Date(),
      });
    }
  });
});

// 6. API Routes
app.use('/api', statusRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/access-requests', accessRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/admin/audit-log', auditRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/shoots', shootRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/uploads', uploadRoutes);
app.use('/api/deliverables', deliverableRoutes);
app.use('/api/files', (req, res, next) => {
  req.url = '/files' + (req.url === '/' ? '' : req.url);
  deliverableRoutes(req, res, next);
});
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/docs', docsRoutes);

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
