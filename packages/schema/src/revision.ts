import { z } from 'zod';
import { SourceRefSchema } from './station';

export const RevisionSchema = z.object({
  id: z.string().min(1),
  entity_type: z.enum(['station', 'line', 'segment']),
  entity_id: z.string().min(1),
  rev_number: z.number().int().positive(),
  parent_rev_id: z.string().nullable(),
  content: z.record(z.string(), z.unknown()),
  actor_id: z.string().min(1),
  actor_role: z.enum(['contributor', 'editor', 'approver', 'owner', 'bot']),
  created_at: z.string().datetime(),
  edit_summary: z.string().min(1),
  source_refs: z.array(SourceRefSchema).min(1),
  is_minor: z.boolean(),
  is_bot: z.boolean(),
  revert_of: z.string().nullable(),
  content_hash: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
});
export type Revision = z.infer<typeof RevisionSchema>;
