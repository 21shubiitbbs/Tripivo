import { Router } from 'express';

export const tripsRouter = Router();

// Placeholder until trips are persisted.
tripsRouter.get('/', (_request, response) => {
  response.json({ trips: [] });
});
