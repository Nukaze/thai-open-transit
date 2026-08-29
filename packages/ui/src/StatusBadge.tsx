// packages/ui/src/StatusBadge.tsx
import type { Status } from "schema";

const STATUS_LABEL: Record<Status, string> = {
  operational: "Operational",
  trial: "Trial service",
  under_construction: "Under construction",
  approved: "Approved",
  planned: "Planned",
  proposed: "Proposed",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span data-status={status}>{STATUS_LABEL[status]}</span>;
}
