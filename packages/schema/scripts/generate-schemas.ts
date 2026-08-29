import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  StationSchema,
  LineSchema,
  SegmentSchema,
  RevisionSchema,
  LayoutSchema,
} from '../src/index';

const schemas = {
  station: StationSchema,
  line: LineSchema,
  segment: SegmentSchema,
  revision: RevisionSchema,
  layout: LayoutSchema,
};

mkdirSync(new URL('../schemas', import.meta.url), { recursive: true });

for (const [name, schema] of Object.entries(schemas)) {
  const jsonSchema = z.toJSONSchema(schema);
  writeFileSync(
    new URL(`../schemas/${name}.json`, import.meta.url),
    JSON.stringify(jsonSchema, null, 2) + '\n',
  );
}
