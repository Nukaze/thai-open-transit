import { describe, it, expect } from 'vitest';
import { RevisionSchema } from './revision';

describe('RevisionSchema', () => {
  it('accepts a valid revision and rejects empty source_refs', () => {
    const base = {
      id: 'rev_1',
      entity_type: 'station',
      entity_id: 'BL15',
      rev_number: 1,
      parent_rev_id: null,
      content: { id: 'BL15' },
      actor_id: 'user_1',
      actor_role: 'editor',
      created_at: '2026-07-01T00:00:00Z',
      edit_summary: 'Initial import',
      source_refs: [{ url: 'https://example.com', title: 'x', published_at: null }],
      is_minor: false,
      is_bot: false,
      revert_of: null,
      content_hash: 'abc123',
      size_bytes: 512,
    };
    expect(RevisionSchema.safeParse(base).success).toBe(true);
    expect(RevisionSchema.safeParse({ ...base, source_refs: [] }).success).toBe(false);
  });
});
