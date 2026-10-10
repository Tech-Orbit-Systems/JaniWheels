"use client";

import { BrowseError } from "@/components/BrowseError";

export default function Error({ reset }: { reset: () => void }) {
  return <BrowseError label="Car" href="/used-cars" reset={reset} />;
}
