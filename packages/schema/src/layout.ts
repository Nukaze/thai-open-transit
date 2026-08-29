import { z } from 'zod';

export const LayoutSchema = z.object({
  era: z.string().min(1),
  stations: z.array(
    z.object({
      station_id: z.string().min(1),
      x: z.number(),
      y: z.number(),
    }),
  ),
});
export type Layout = z.infer<typeof LayoutSchema>;
