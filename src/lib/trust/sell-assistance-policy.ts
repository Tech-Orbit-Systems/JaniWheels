export const SELL_ASSISTANCE_STATUSES = [
  "requested",
  "contacted",
  "details_confirmed",
  "ad_preparation",
  "ad_live",
  "buyer_follow_up",
  "sold",
  "cancelled",
] as const;

export type SellAssistanceStatus = (typeof SELL_ASSISTANCE_STATUSES)[number];

const transitions: Record<SellAssistanceStatus, readonly SellAssistanceStatus[]> = {
  requested: ["contacted", "cancelled"],
  contacted: ["details_confirmed", "cancelled"],
  details_confirmed: ["ad_preparation", "cancelled"],
  ad_preparation: ["ad_live", "cancelled"],
  ad_live: ["buyer_follow_up", "sold", "cancelled"],
  buyer_follow_up: ["ad_live", "sold", "cancelled"],
  sold: [],
  cancelled: [],
};

export function isSellAssistanceStatus(value: string): value is SellAssistanceStatus {
  return SELL_ASSISTANCE_STATUSES.includes(value as SellAssistanceStatus);
}

export function allowedSellAssistanceTransitions(status: SellAssistanceStatus) {
  return transitions[status];
}

export function sellAssistanceStatusLabel(status: SellAssistanceStatus) {
  return ({
    requested: "Request received",
    contacted: "Customer contacted",
    details_confirmed: "Details confirmed",
    ad_preparation: "Ad preparation",
    ad_live: "Ad live",
    buyer_follow_up: "Buyer follow-up",
    sold: "Sold",
    cancelled: "Cancelled",
  } satisfies Record<SellAssistanceStatus, string>)[status];
}

export function validateSellAssistanceUpdate(input: {
  current: SellAssistanceStatus;
  next: SellAssistanceStatus;
  internalNote: string;
  customerMessage: string;
}) {
  const changed = input.current !== input.next;
  if (changed && !transitions[input.current].includes(input.next)) {
    return `${sellAssistanceStatusLabel(input.current)} cannot move to ${sellAssistanceStatusLabel(input.next)}.`;
  }
  if (changed && input.customerMessage.trim().length < 5) {
    return "Add a customer-visible update when changing the status.";
  }
  if (!changed && input.internalNote.trim().length < 3) {
    return "Add an internal note, or change the status.";
  }
  return null;
}
