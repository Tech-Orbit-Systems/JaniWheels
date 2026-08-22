/** Central policy limits for the listing moderation lifecycle. */
export const MAX_REJECTIONS_PER_LISTING = 3;
export const MAX_FINAL_REMOVALS_PER_USER = 7;

export function rejectionDecision(rejectionsBefore: number) {
  const rejectionNumber = rejectionsBefore + 1;
  return {
    rejectionNumber,
    isFinal: rejectionNumber >= MAX_REJECTIONS_PER_LISTING,
  };
}

export function shouldBanAfterFinalRemoval(finalRemovals: number) {
  return finalRemovals > MAX_FINAL_REMOVALS_PER_USER;
}
