"use client";

import { BrowseError } from "@/components/BrowseError";

export default function Error({ reset }: { reset: () => void }) {
  return <BrowseError label="Auto part" href="/auto-parts" reset={reset} />;
}
