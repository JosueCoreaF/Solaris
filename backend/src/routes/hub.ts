import { Router } from 'express';
import { requireOwner } from '../middleware/auth';
import { getDashboardSummary } from '../controllers/hub/dashboard';
import { createBusiness } from '../controllers/hub/business';

const router = Router();

router.get('/dashboard-summary', requireOwner, getDashboardSummary);
router.post('/businesses', requireOwner, createBusiness);

export default router;
