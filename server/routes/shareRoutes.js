import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import * as c from '../controllers/watchController.js';

const router = Router();

router.get('/:token', asyncHandler(c.getSharedWatch));
router.get('/:token/diff', asyncHandler(c.getSharedDiff));

export default router;
