import { OpenAPIHono } from '@hono/zod-openapi';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import multiSwap from './route';


const app = new OpenAPIHono();
app.use('/*', cors());

// Routes
app.route('/api/swap', multiSwap);


app.doc('/doc', {
  info: {
    title: 'Multi-Token Swap',
    version: 'v1',
  },
  openapi: '3.1.0',
});

app.get(
  '/swagger-ui',
  swaggerUI({
    url: '/doc',
  }),
);

const port = 3000;
console.log(`Server is running on port ${port}`);
console.log(`Visit http://localhost:${port}/swagger-ui to explore the API`);
console.log(`Visit https://actions.dialect.to to unfurl action into a Blink`);

serve({
  fetch: app.fetch,
  port,
});