import { z } from 'zod';
import { MilestoneSchema } from './station';

export const LineSchema = z.object({
  id: z.string().regex(/^[A-Z]+_[A-Z]+$/, 'Line id must be {OPERATOR}_{COLOR}'),
  operator: z.string().min(1),
  name_th: z.string().min(1),
  name_en: z.string().min(1),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'color_hex must be a 6-digit hex color'),
  milestones: z.array(MilestoneSchema),
  confidence: z.enum(['high', 'medium', 'low']),
  last_verified_at: z.string().date(),
});
export type Line = z.infer<typeof LineSchema>;
