import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { CacheService } from '../../../infrastructure/cache/redis.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { ValidationError } from '../../../lib/errors.js';

const router = Router();
const cache = new CacheService('products:');

const createProductSchema = z.object({
  branchId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  basePrice: z.number().positive(),
  imageUrl: z.string().url().optional(),
  preparationTime: z.number().int().positive().default(5),
  isFeatured: z.boolean().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const where: any = { isActive: true, deletedAt: null };
    if (category) where.categoryId = category;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true, slug: true } } },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: { products, total, page: pageNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, customizations: true },
    });
    if (!product) throw new ValidationError('Product not found');
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await prisma.product.create({
      data: { ...data, attributes: {} },
      include: { category: true },
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createProductSchema.partial().parse(req.body);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { category: true },
    });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

export { router as productRouter };
