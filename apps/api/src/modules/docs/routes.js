import { Router } from 'express';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { openApiSpec } from './openapi.js';

const router = Router();

// In production, Swagger/OpenAPI documentation is protected behind Admin authentication
const guardDocs = (req, res, next) => {
  if (env.NODE_ENV === 'production') {
    return authenticate(req, res, () => {
      return requirePermission('settings.manage')(req, res, next);
    });
  }
  next();
};

router.use(guardDocs);

// 1. Raw OpenAPI 3.0 JSON specification
router.get('/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(openApiSpec);
});

// 2. Interactive Swagger UI Explorer
router.get('/', (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Marketing Portal API Reference</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background-color: #0b0d13; color: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; }
    .swagger-ui { background-color: #0b0d13; color: #f1f5f9; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #8b5cf6; }
    .swagger-ui .opblock { border-radius: 8px; margin-bottom: 12px; }
    .swagger-ui .opblock .opblock-summary-operation-id,
    .swagger-ui .opblock .opblock-summary-path { color: #f8fafc; font-weight: 600; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
});

export default router;
