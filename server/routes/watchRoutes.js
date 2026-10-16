import { Router } from 'express';
import mongoose from 'mongoose';
import { asyncHandler, HttpError } from '../middlewares/errorHandler.js';
import * as c from '../controllers/watchController.js';

const router = Router();

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return next(new HttpError(404, 'Watch not found'));
  next();
});

router.get('/preview', asyncHandler(c.previewPage)); // must come before /:id

router.route('/').get(asyncHandler(c.listWatches)).post(asyncHandler(c.createWatch));
router.route('/:id').get(asyncHandler(c.getWatch)).put(asyncHandler(c.updateWatch)).delete(asyncHandler(c.deleteWatch));
router.post('/:id/check', asyncHandler(c.checkNow));
router.post('/:id/share', asyncHandler(c.createShareLink));
router.delete('/:id/share', asyncHandler(c.deleteShareLink));
router.get('/:id/snapshots', asyncHandler(c.getSnapshots));
router.get('/:id/diff', asyncHandler(c.getDiff));

export default router;
