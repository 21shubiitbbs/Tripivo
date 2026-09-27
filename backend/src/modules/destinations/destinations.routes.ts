import { Router } from 'express';
import { listDestinations } from './destinations.repository.js';

export const destinationsRouter = Router();

/** The destination catalog, most popular first. Public: shown before trips load. */
destinationsRouter.get('/', async (_request, response) => {
  response.json({ destinations: await listDestinations() });
});
