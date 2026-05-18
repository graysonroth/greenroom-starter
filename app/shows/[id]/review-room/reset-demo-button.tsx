"use client";

import { Button } from "@/components/ui/button";
import { reviewActionStorageKey } from "@/lib/settlementReviewRoom";
import { resetExpectedAmount } from "../review/financial-summary";

export function ResetReviewDemoButton({
  showId,
  className,
}: {
  showId: string;
  className?: string;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={className}
      onClick={() => {
        const storageKey = reviewActionStorageKey(showId);
        window.localStorage.removeItem(storageKey);
        resetExpectedAmount(showId);
        window.dispatchEvent(new Event(storageKey));
      }}
    >
      Reset demo
    </Button>
  );
}
