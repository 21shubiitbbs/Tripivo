import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'tripivo-api' });
});

app.get('/api/trips', (_request, response) => {
  response.json({ trips: [] });
});

app.listen(port, () => {
  console.log(`Tripivo API listening on http://localhost:${port}`);
});