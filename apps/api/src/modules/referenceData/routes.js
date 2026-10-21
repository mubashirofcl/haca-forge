import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as referenceController from './controller.js';

const router = express.Router();

// Reference taxonomies can be fetched by authenticated users
router.use(authenticate);

router.get('/', referenceController.getAll);
router.get('/profiles', referenceController.getProfiles);
router.get('/departments', referenceController.getDepartments);

export default router;
