/**
 * OpenAPI 3.0 Specification for Marketing Workflow & Content Management Portal
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Marketing Workflow & Content Management Portal API',
    version: '1.0.0',
    description:
      'Production API for marketing requests, social media calendar planning, content items, stage-by-stage pipelines, shoot planner, review studio, time tracking, and analytics.',
    contact: {
      name: 'Engineering Team',
      email: 'dev@marketingportal.com',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Current Environment API Server',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
        description: 'httpOnly JWT access cookie',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'FORBIDDEN' },
              message: { type: 'string', example: 'You do not have permission to perform this action.' },
              details: { type: 'object' },
            },
            required: ['code', 'message'],
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: {
            type: 'string',
            enum: ['admin', 'management', 'head', 'team_lead', 'worker', 'sm_manager', 'dept_lead', 'dept_staff'],
          },
          department: { type: 'string' },
          teamId: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' } },
          weeklyCapacityHours: { type: 'number' },
        },
      },
      Request: {
        type: 'object',
        properties: {
          requestId: { type: 'string', example: 'MKT-2026-0001' },
          title: { type: 'string' },
          sourceDepartment: { type: 'string' },
          requester: { type: 'string' },
          status: {
            type: 'string',
            enum: ['draft', 'submitted', 'under_triage', 'accepted', 'rejected', 'needs_info', 'converted'],
          },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          deadline: { type: 'string', format: 'date-time' },
        },
      },
      ContentItem: {
        type: 'object',
        properties: {
          contentId: { type: 'string', example: 'CNT-2026-0001' },
          title: { type: 'string' },
          format: { type: 'string', enum: ['reel', 'post', 'carousel', 'story', 'ad_creative', 'brochure', 'academic'] },
          status: {
            type: 'string',
            enum: ['planned', 'brief_ready', 'in_production', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'live'],
          },
          publishDate: { type: 'string', format: 'date-time' },
          productionDeadline: { type: 'string', format: 'date-time' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          taskId: { type: 'string', example: 'TSK-2026-0001' },
          title: { type: 'string' },
          stageKey: { type: 'string' },
          team: { type: 'string', enum: ['content', 'graphics', 'cinematography', 'editor'] },
          status: { type: 'string', enum: ['assigned', 'in_progress', 'submitted', 'changes_requested', 'done', 'blocked', 'on_hold'] },
          estimateHours: { type: 'number' },
          actualHours: { type: 'number' },
        },
      },
    },
  },
  paths: {
    '/status': {
      get: {
        summary: 'System health & process status',
        tags: ['System'],
        responses: {
          200: { description: 'Service status' },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Liveness probe',
        tags: ['System'],
        responses: {
          200: { description: 'API process is alive' },
        },
      },
    },
    '/ready': {
      get: {
        summary: 'Readiness probe',
        tags: ['System'],
        description: 'Verifies MongoDB connection state before routing traffic.',
        responses: {
          200: { description: 'All database connections healthy and ready' },
          503: { description: 'Database disconnected or initializing' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'User login',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful, httpOnly cookies set' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current user session and CASL permissions',
        tags: ['Auth'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: 'Authenticated user profile with permission array' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/requests': {
      get: {
        summary: 'List work requests (scoped by department and role)',
        tags: ['Requests'],
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Paginated request items' },
        },
      },
      post: {
        summary: 'Submit new work request',
        tags: ['Requests'],
        security: [{ cookieAuth: [] }],
        responses: {
          201: { description: 'Request created' },
        },
      },
    },
    '/content': {
      get: {
        summary: 'List content items (scoped)',
        tags: ['Content'],
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Paginated content items' },
        },
      },
    },
    '/tasks': {
      get: {
        summary: 'List tasks with queue/status filters',
        tags: ['Tasks'],
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'List of tasks' },
        },
      },
    },
    '/reports/department': {
      get: {
        summary: 'Department throughput, on-time rate and aging analytics',
        tags: ['Reports'],
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Department report metrics' },
        },
      },
    },
    '/reports/export': {
      get: {
        summary: 'Stream report spreadsheet in XLSX or CSV format',
        tags: ['Reports'],
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' }, required: true },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['xlsx', 'csv'] } },
        ],
        responses: {
          200: { description: 'Binary spreadsheet file download' },
        },
      },
    },
  },
};
