import { z } from 'zod';

export const DatePrecisionSchema = z.enum(['exact', 'month', 'year', 'disputed']);
export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

export const MilestoneEventSchema = z.enum([
  'construction_started',
  'trial_run',
  'opened',
  'extended',
  'renamed',
  'recoded',
  'suspended',
  'closed',
]);
export type MilestoneEvent = z.infer<typeof MilestoneEventSchema>;

export const SourceRefSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  published_at: z.string().date().nullable().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const MilestoneSchema = z
  .object({
    date: z.string().date(),
    date_precision: DatePrecisionSchema,
    event: MilestoneEventSchema,
    line: z.string().min(1).optional(),
    source_refs: z.array(SourceRefSchema).min(1),
  })
  .refine(
    (m) => m.date_precision !== 'disputed' || m.source_refs.length >= 2,
    { message: 'disputed date_precision requires at least 2 source_refs' },
  );
export type Milestone = z.infer<typeof MilestoneSchema>;

export const StatusSchema = z.enum([
  'operational',
  'trial',
  'under_construction',
  'approved',
  'planned',
  'proposed',
  'suspended',
  'cancelled',
]);
export type Status = z.infer<typeof StatusSchema>;

export const StationSchema = z.object({
  id: z.string().min(1),
  name_th: z.string().min(1),
  name_en: z.string().min(1).nullable(),
  code_history: z
    .array(
      z.object({
        code: z.string().min(1),
        from: z.string().date(),
        to: z.string().date().nullable(),
      }),
    )
    .min(1),
  interchange_group: z.string().min(1).nullable().optional(),
  structure: z.enum(['underground', 'elevated', 'at_grade']),
  accessible: z.boolean(),
  coords: z.object({
    geo: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
    schematic: z.object({ x: z.number(), y: z.number() }).optional(),
  }),
  validity: z.array(
    z.object({
      line: z.string().min(1),
      from: z.string().date(),
      to: z.string().date().nullable(),
    }),
  ),
  milestones: z.array(MilestoneSchema),
  confidence: z.enum(['high', 'medium', 'low']),
  last_verified_at: z.string().date(),
});
export type Station = z.infer<typeof StationSchema>;
