import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';
import { productRouter } from './product.routes.js';
import { orderRouter } from './order.routes.js';
import { tableRouter } from './table.routes.js';
import { adminRouter } from './admin.routes.js';

const router = Router();

// Mount route modules
router.use('/auth', authRouter);
router.use('/health', healthRouter);
router.use('/products', productRouter);
router.use('/orders', orderRouter);
router.use('/tables', tableRouter);
router.use('/admin', adminRouter);

export { router as v1Router };
