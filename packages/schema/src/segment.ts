import { z } from 'zod';
import { MilestoneSchema } from './station';

export const SegmentSchema = z
  .object({
    id: z.string().regex(/^.+__.+$/, 'Segment id must be {FROM}__{TO}'),
    line: z.string().min(1),
    from_station: z.string().min(1),
    to_station: z.string().min(1),
    milestones: z.array(MilestoneSchema),
    confidence: z.enum(['high', 'medium', 'low']),
    last_verified_at: z.string().date(),
  })
  .refine((s) => s.id === `${s.from_station}__${s.to_station}`, {
    message: 'Segment id must equal {from_station}__{to_station}',
  });
export type Segment = z.infer<typeof SegmentSchema>;
