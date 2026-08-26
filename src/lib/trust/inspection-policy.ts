export const INSPECTION_STATUSES = [
  "requested",
  "contacted",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

const transitions: Record<InspectionStatus, readonly InspectionStatus[]> = {
  requested: ["contacted", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isInspectionStatus(value: string): value is InspectionStatus {
  return INSPECTION_STATUSES.includes(value as InspectionStatus);
}

export function allowedInspectionTransitions(status: InspectionStatus) {
  return transitions[status];
}

export function validateInspectionUpdate(input: {
  current: InspectionStatus;
  next: InspectionStatus;
  internalNote: string;
  customerMessage: string;
}): string | null {
  const changed = input.current !== input.next;
  if (changed && !transitions[input.current].includes(input.next)) {
    return `A ${input.current} request cannot move to ${input.next}.`;
  }
  if (changed && input.customerMessage.trim().length < 5) {
    return "Add a customer update when changing status.";
  }
  if (!changed && input.internalNote.trim().length < 3) {
    return "Add an internal note, or change the status.";
  }
  return null;
}

export function inspectionStatusLabel(status: InspectionStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
