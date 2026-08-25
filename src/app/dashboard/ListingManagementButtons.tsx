"use client";

import { useState, useTransition } from "react";
import {
  deleteListingAction,
  reactivateListingAction,
} from "@/lib/listings/manage-actions";

export function ListingManagementButtons({
  listingId,
  canReactivate,
}: {
  listingId: number;
  canReactivate: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirmDelete) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-red-700">Delete this ad and its photos?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteListingAction(listingId))}
          className="rounded bg-red-700 px-2 py-1 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmDelete(false)}
          className="text-slate-500 underline"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <>
      {canReactivate && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => reactivateListingAction(listingId))}
          className="font-medium text-blue-700 underline hover:text-blue-900 disabled:opacity-60"
        >
          {pending ? "Reactivating…" : "Reactivate for 30 days"}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
        className="text-red-700 underline hover:text-red-900 disabled:opacity-60"
      >
        Delete ad
      </button>
    </>
  );
}
