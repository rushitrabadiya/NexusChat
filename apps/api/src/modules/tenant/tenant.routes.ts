import { Router } from 'express';
import { createTenant, getTenants, getTenantByCode, deleteTenant } from './tenant.controller';

const router: Router = Router();

router.post('/', createTenant);
router.get('/', getTenants);
router.get('/code/:code', getTenantByCode);
router.delete('/:id', deleteTenant);

export default router;
