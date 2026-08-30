import { z } from "zod";
import { MilestoneSchema } from "./station";

/** [lon, lat], GeoJSON axis order. */
export const PositionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const LineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(PositionSchema).min(2),
});

/**
 * Where a segment's geometry came from, so a re-derivation pass knows what it
 * may overwrite. `manual` is a lock: an editor drew or corrected that line by
 * hand and a bulk re-import must not silently discard it. `straight` marks the
 * chord fallback, which is what a brand-new segment gets before anyone has
 * traced it - it renders, it is just crude, and it is honest about being so.
 */
export const GeometrySourceSchema = z.enum(["osm", "manual", "straight"]);
export type GeometrySource = z.infer<typeof GeometrySourceSchema>;

export const SegmentSchema = z
  .object({
    id: z.string().regex(/^.+__.+$/, "Segment id must be {FROM}__{TO}"),
    line: z.string().min(1),
    from_station: z.string().min(1),
    to_station: z.string().min(1),
    // Null is a legal, useful state: the build falls back to a straight chord
    // between the two stations, so adding a station never blocks on tracing
    // its geometry first.
    geometry: LineStringSchema.nullable(),
    geometry_source: GeometrySourceSchema,
    // The OSM ways the geometry was sliced out of. Storing the inputs next to
    // the output is what makes the derivation repeatable: when OSM improves,
    // re-run the importer rather than redraw by hand.
    osm_way_refs: z.array(z.number().int().positive()),
    // Segments get realigned, extended and closed, so time travel (SPEC 2.1)
    // has to filter them exactly as it filters stations. Same shape as
    // StationSchema.validity minus the per-line key, since a segment belongs
    // to exactly one line already.
    validity: z.array(
      z.object({
        from: z.string().date(),
        to: z.string().date().nullable(),
      }),
    ),
    milestones: z.array(MilestoneSchema),
    confidence: z.enum(["high", "medium", "low"]),
    last_verified_at: z.string().date(),
  })
  .refine((s) => s.id === `${s.from_station}__${s.to_station}`, {
    message: "Segment id must equal {from_station}__{to_station}",
  })
  .refine((s) => (s.geometry === null) === (s.geometry_source === "straight"), {
    message:
      "geometry_source must be 'straight' when geometry is null, and a real source otherwise",
  });
export type Segment = z.infer<typeof SegmentSchema>;
