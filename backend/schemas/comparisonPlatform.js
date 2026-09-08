import { z } from 'zod';

export const CreateComparisonPlatformSchema = z.object({
  name: z.string().min(1).max(60),
  logoUrl: z.string().url().optional(),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const UpdateComparisonPlatformSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  logoUrl: z.string().url().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const ComparisonPlatformIdParam = z.object({
  id: z.string().min(1),
});
