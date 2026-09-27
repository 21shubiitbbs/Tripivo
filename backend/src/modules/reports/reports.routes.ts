import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { REPORT_TARGET_TYPES } from '../../db/schema/index.js';
import { HttpError } from '../../shared/http/errors.js';
import { isUuid, oneOf, requiredString } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

/** `{ targetType: 'user' | 'trip' | 'message' | 'other', targetId?, details }`, for the safety team. */
reportsRouter.post('/', async (request, response) => {
  const body = request.body ?? {};
  const targetType = oneOf(REPORT_TARGET_TYPES, body.targetType, 'targetType');
  const targetId = body.targetId === undefined || body.targetId === null ? null : body.targetId;
  if (targetId !== null && !isUuid(targetId)) throw HttpError.badRequest('targetId must be an id');
  const details = requiredString(body.details, 'details', 4000);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO reports (reporter_id, target_type, target_id, details) VALUES ($1, $2, $3, $4) RETURNING id`,
    [response.locals.userId, targetType, targetId, details],
  );
  response.status(201).json({ report: { id: rows[0].id, status: 'open' } });
});
