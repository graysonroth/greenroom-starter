"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, CircleHelp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlainBadge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import {
  reviewActionStorageKey,
  type MathAnnotation,
  type StoredReviewAction,
  type StoredReviewItem,
  type StoredReviewState,
} from "@/lib/settlementReviewRoom";
import { ExpectedPayoutInput, resetExpectedAmount } from "./financial-summary";

const ACTION_LABELS: Record<StoredReviewAction, string> = {
  unreviewed: "Unreviewed",
  acknowledged: "Acknowledged",
  questioned: "Questioned",
  contested: "Contested",
};

export function ReviewerActions({
  rows,
  showId,
  proposedAmount,
  defaultExpectedAmount,
}: {
  rows: MathAnnotation[];
  showId: string;
  proposedAmount?: number | null;
  defaultExpectedAmount?: number | null;
}) {
  const storageKey = reviewActionStorageKey(showId);
  const snapshot = useSyncExternalStore(
    (onStoreChange) => subscribeToReviewActions(storageKey, onStoreChange),
    () => readReviewActionsSnapshot(storageKey),
    () => "",
  );
  const actions = useMemo(
    () => mergeStoredActions(rows, snapshot),
    [rows, snapshot],
  );
  const [submittedNotes, setSubmittedNotes] = useState<Record<string, boolean>>(
    {},
  );
  const [submittedFollowUps, setSubmittedFollowUps] = useState<
    Record<string, boolean>
  >({});
  const [commenterName, setCommenterName] = useState("Daniel Hwang, WME");
  const [pendingActionChange, setPendingActionChange] = useState<{
    rowId: string;
    nextAction: StoredReviewAction;
    currentAction: StoredReviewAction;
  } | null>(null);
  const reviewState = useMemo(
    () => mergeStoredReviewState(rows, snapshot),
    [rows, snapshot],
  );

  const summary = useMemo(() => {
    const values = Object.values(actions);
    const resolved = Object.values(reviewState).filter(
      (item) => item.resolutionAccepted,
    ).length;
    return {
      acknowledged: values.filter((value) => value === "acknowledged").length,
      questioned: values.filter((value) => value === "questioned").length,
      contested: values.filter((value) => value === "contested").length,
      resolved,
    };
  }, [actions, reviewState]);

  const openCount = summary.questioned + summary.contested;

  const markAllReady = () => {
    writeReviewState(
      storageKey,
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            ...reviewState[row.id],
            action: "acknowledged",
            resolutionAccepted: true,
          },
        ]),
      ) as StoredReviewState,
    );
  };

  const resetDemoState = () => {
    window.localStorage.removeItem(storageKey);
    resetExpectedAmount(showId);
    window.dispatchEvent(new Event(storageKey));
  };

  const updateAction = (rowId: string, action: StoredReviewAction) => {
    writeReviewState(storageKey, {
      ...reviewState,
      [rowId]: {
        ...reviewState[rowId],
        action,
        resolutionAccepted: false,
      },
    });
  };

  const requestActionChange = (
    rowId: string,
    nextAction: StoredReviewAction,
  ) => {
    const currentAction = actions[rowId] ?? "unreviewed";
    if (
      currentAction !== "unreviewed" &&
      currentAction !== nextAction
    ) {
      setPendingActionChange({ rowId, nextAction, currentAction });
      return;
    }
    updateAction(rowId, nextAction);
  };

  const confirmActionChange = () => {
    if (!pendingActionChange) return;
    updateAction(pendingActionChange.rowId, pendingActionChange.nextAction);
    setPendingActionChange(null);
  };

  const updateNote = (rowId: string, note: string) => {
    setSubmittedNotes((current) => ({ ...current, [rowId]: false }));
    writeReviewState(storageKey, {
      ...reviewState,
      [rowId]: {
        ...reviewState[rowId],
        action: reviewState[rowId]?.action ?? "unreviewed",
        noteDraft: note,
      },
    });
  };

  const submitNote = (rowId: string) => {
    const draft = reviewState[rowId]?.noteDraft?.trim();
    if (!draft) return;
    const author = commenterName.trim() || "Reviewer";
    writeReviewState(storageKey, {
      ...reviewState,
      [rowId]: {
        ...reviewState[rowId],
        note: draft,
        noteAuthor: author,
        noteDraft: "",
      },
    });
    setSubmittedNotes((current) => ({ ...current, [rowId]: true }));
  };

  const updateFollowUpDraft = (rowId: string, reviewerFollowUpDraft: string) => {
    setSubmittedFollowUps((current) => ({ ...current, [rowId]: false }));
    writeReviewState(storageKey, {
      ...reviewState,
      [rowId]: {
        ...reviewState[rowId],
        reviewerFollowUpDraft,
        resolutionAccepted: false,
      },
    });
  };

  const submitFollowUp = (rowId: string) => {
    const draft = reviewState[rowId]?.reviewerFollowUpDraft?.trim();
    if (!draft) return;
    const author = commenterName.trim() || "Reviewer";
    const previousReplies =
      reviewState[rowId]?.reviewerFollowUps ??
      (reviewState[rowId]?.reviewerFollowUp
        ? [reviewState[rowId].reviewerFollowUp]
        : []);
    writeReviewState(storageKey, {
      ...reviewState,
      [rowId]: {
        ...reviewState[rowId],
        reviewerFollowUps: [...previousReplies, draft],
        reviewerFollowUpAuthors: [
          ...(reviewState[rowId]?.reviewerFollowUpAuthors ?? []),
          author,
        ],
        reviewerFollowUp: "",
        reviewerFollowUpDraft: "",
        resolutionAccepted: false,
      },
    });
    setSubmittedFollowUps((current) => ({ ...current, [rowId]: true }));
  };

  const acceptResolution = (rowId: string) => {
    writeReviewState(storageKey, {
      ...reviewState,
      [rowId]: {
        ...reviewState[rowId],
        action: "acknowledged",
        resolutionAccepted: true,
      },
    });
  };

  const reopenResolution = (rowId: string) => {
    writeReviewState(storageKey, {
      ...reviewState,
      [rowId]: {
        ...reviewState[rowId],
        action:
          reviewState[rowId]?.action === "acknowledged"
            ? "questioned"
            : reviewState[rowId]?.action ?? "questioned",
        resolutionAccepted: false,
        reviewerPositionAccepted: false,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink-200/70 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-ink-900">
              Your review
            </div>
            <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
              Mark only the lines that need discussion. The venue sees the same
              state in the Review Room.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="eyebrow text-[9px] text-ink-500 mb-1 block">
                Your Name
              </span>
              <input
                type="text"
                value={commenterName}
                onChange={(event) => setCommenterName(event.target.value)}
                placeholder="Name, company or role"
                className="h-8 w-48 rounded-md border border-ink-200/80 bg-white px-2 text-[12px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-300"
              />
            </label>
            <Button size="sm" variant="secondary" onClick={resetDemoState}>
              Reset demo
            </Button>
            <Button size="sm" variant="brand" onClick={markAllReady}>
              <Check className="h-3.5 w-3.5" />
              Acknowledge all
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <ExpectedPayoutInput
            showId={showId}
            proposedAmount={proposedAmount}
            defaultExpectedAmount={defaultExpectedAmount}
          />
        </div>

        <div className="mt-4 rounded-lg bg-canvas-soft ring-1 ring-ink-200/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12.5px] font-medium text-ink-900">
                {openCount > 0
                  ? `${openCount} item${openCount === 1 ? "" : "s"} need alignment`
                  : "Ready for signoff"}
              </div>
              <div className="text-[11.5px] text-ink-500 mt-0.5">
                {summary.resolved} resolved · {summary.acknowledged} acknowledged
              </div>
            </div>
            <PlainBadge variant={openCount > 0 ? "amber" : "brand"}>
              {openCount > 0 ? "Needs alignment" : "Ready"}
            </PlainBadge>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PlainBadge variant="brand">
            {summary.acknowledged} acknowledged
          </PlainBadge>
          <PlainBadge variant="amber">
            {summary.questioned} questioned
          </PlainBadge>
          <PlainBadge variant="rose">{summary.contested} contested</PlainBadge>
        </div>
      </div>

      <div className="rounded-lg border border-ink-200/70 bg-white divide-y divide-ink-100/80">
        {rows.map((row) => (
          <div key={row.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-ink-900">
                    {row.label}
                  </span>
                  {reviewState[row.id]?.resolutionAccepted && (
                    <PlainBadge variant="brand">Accepted resolution</PlainBadge>
                  )}
                </div>
                <div className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                  {row.rationale}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="font-mono tabular text-[13.5px] font-semibold text-ink-900">
                  {row.value == null ? "—" : formatMoney(row.value)}
                </div>
                <ActionBadge action={actions[row.id] ?? "unreviewed"} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ReviewStatusButton
                action="acknowledged"
                currentAction={actions[row.id] ?? "unreviewed"}
                onClick={() => requestActionChange(row.id, "acknowledged")}
              />
              <ReviewStatusButton
                action="questioned"
                currentAction={actions[row.id] ?? "unreviewed"}
                onClick={() => requestActionChange(row.id, "questioned")}
              />
              <ReviewStatusButton
                action="contested"
                currentAction={actions[row.id] ?? "unreviewed"}
                onClick={() => requestActionChange(row.id, "contested")}
              />
            </div>

            {!reviewState[row.id]?.note?.trim() && (
            <div className="mt-3 rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 p-3">
              <label
                htmlFor={`note-${row.id}`}
                className="eyebrow text-[9px] text-ink-500 mb-1.5 block"
              >
                Add context for the venue
              </label>
              <textarea
                id={`note-${row.id}`}
                value={reviewState[row.id]?.noteDraft ?? ""}
                onChange={(event) => updateNote(row.id, event.target.value)}
                placeholder="Add context, e.g. 'Was this marketing recoup inside the cap?'"
                rows={2}
                className="w-full rounded-lg border border-ink-200/80 bg-white px-3 py-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-300"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => submitNote(row.id)}
                  disabled={!reviewState[row.id]?.noteDraft?.trim()}
                >
                  Submit note
                </Button>
                {submittedNotes[row.id] && (
                  <PlainBadge variant="brand">Submitted to venue</PlainBadge>
                )}
              </div>
            </div>
            )}

            {(reviewState[row.id]?.note?.trim() ||
              reviewState[row.id]?.venueResponse?.trim()) && (
              <div className="mt-3 rounded-lg bg-brand-50/30 ring-1 ring-brand-200/60 p-3">
                <details open>
                  <summary className="cursor-pointer text-[12px] font-medium text-ink-900">
                    Thread with venue
                  </summary>
                  <div className="mt-3 space-y-3 border-l-2 border-brand-200/70 pl-3">
                    {reviewState[row.id]?.note?.trim() && (
                      <div className="relative rounded-md bg-white/90 ring-1 ring-brand-200/60 px-3 py-2">
                        <span className={`absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full ring-2 ring-white ${speakerDotClass(reviewState[row.id]?.noteAuthor)}`} />
                        <div className="eyebrow text-[9px] text-brand-800 mb-1">
                          {reviewState[row.id]?.noteAuthor ?? "Reviewer"}
                        </div>
                        <div className="text-[12.5px] text-ink-800 leading-relaxed">
                          {reviewState[row.id]?.note}
                        </div>
                      </div>
                    )}

                    {reviewState[row.id]?.venueResponse?.trim() && (
                    <div className="relative rounded-md bg-white/90 ring-1 ring-brand-200/60 px-3 py-2">
                      <span className="absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                      <div className="eyebrow text-[9px] text-brand-800 mb-1">
                        Venue response
                      </div>
                      <div className="text-[12.5px] text-ink-800 leading-relaxed">
                        {reviewState[row.id]?.venueResponse}
                      </div>
                    </div>
                    )}

                    {submittedReplies(reviewState[row.id]).map(
                      (reply, index) => (
                      <div
                        key={`${row.id}-reply-${index}`}
                        className="relative rounded-md bg-white/90 ring-1 ring-brand-200/60 px-3 py-2"
                      >
                        <span className={`absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full ring-2 ring-white ${speakerDotClass(reviewState[row.id]?.reviewerFollowUpAuthors?.[index])}`} />
                        <div className="eyebrow text-[9px] text-brand-800 mb-1">
                          {reviewState[row.id]?.reviewerFollowUpAuthors?.[index] ??
                            `Reviewer reply ${index + 1}`}
                        </div>
                        <div className="text-[12.5px] text-ink-800 leading-relaxed">
                          {reply}
                        </div>
                      </div>
                      ),
                    )}

                    {reviewState[row.id]?.resolutionAccepted ? (
                      <div className="rounded-md bg-brand-50/70 ring-1 ring-brand-200/70 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <PlainBadge variant="brand">Accepted resolution</PlainBadge>
                          <span className="text-[12px] text-ink-700">
                            This line is closed for signoff.
                          </span>
                          <button
                            type="button"
                            onClick={() => reopenResolution(row.id)}
                            className="text-[11.5px] font-medium text-brand-700 hover:text-brand-800"
                          >
                            Reopen
                          </button>
                        </div>
                      </div>
                    ) : (
                    <>
                    <div>
                      <label
                        htmlFor={`follow-up-${row.id}`}
                        className="eyebrow text-[9px] text-ink-500 mb-1.5 block"
                      >
                        Add another comment
                      </label>
                      <textarea
                        id={`follow-up-${row.id}`}
                        value={reviewState[row.id]?.reviewerFollowUpDraft ?? ""}
                        onChange={(event) =>
                          updateFollowUpDraft(row.id, event.target.value)
                        }
                        placeholder="Add more context or reply to the venue..."
                        rows={2}
                        className="w-full rounded-lg border border-ink-200/80 bg-white px-3 py-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-300"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => submitFollowUp(row.id)}
                        disabled={
                          !reviewState[row.id]?.reviewerFollowUpDraft?.trim()
                        }
                      >
                        Submit reply
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="brand"
                        onClick={() => acceptResolution(row.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept resolution
                      </Button>
                      {submittedFollowUps[row.id] && (
                        <PlainBadge variant="brand">Reply sent</PlainBadge>
                      )}
                      {reviewState[row.id]?.resolutionAccepted && (
                        <PlainBadge variant="brand">Resolution accepted</PlainBadge>
                      )}
                    </div>
                    </>
                    )}
                  </div>
                </details>
              </div>
            )}

            {reviewState[row.id]?.reviewerPositionAccepted && (
              <div className="mt-3 rounded-lg bg-brand-50/30 ring-1 ring-brand-200/60 p-3">
                <PlainBadge variant="brand">
                  Venue accepted your position
                </PlainBadge>
                <div className="mt-2 text-[12px] text-ink-700 leading-relaxed">
                  Mariana accepted this reviewer note as the settlement
                  interpretation to carry forward.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {pendingActionChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/25 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl ring-1 ring-ink-200/80 p-5">
            <div className="text-[15px] font-semibold text-ink-900">
              Change review status?
            </div>
            <p className="text-[13px] text-ink-600 leading-relaxed mt-2">
              This line is currently marked{" "}
              <span className="font-medium text-ink-900">
                {ACTION_LABELS[pendingActionChange.currentAction]}
              </span>
              . Change it to{" "}
              <span className="font-medium text-ink-900">
                {ACTION_LABELS[pendingActionChange.nextAction]}
              </span>
              ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingActionChange(null)}
              >
                Cancel
              </Button>
              <Button type="button" variant="brand" onClick={confirmActionChange}>
                Change status
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStatusButton({
  action,
  currentAction,
  onClick,
}: {
  action: ReviewActionForButton;
  currentAction: StoredReviewAction;
  onClick: () => void;
}) {
  const selected = currentAction === action;
  const Icon =
    action === "acknowledged"
      ? Check
      : action === "questioned"
        ? CircleHelp
        : XCircle;
  const label =
    action === "acknowledged"
      ? "Acknowledge"
      : action === "questioned"
        ? "Question"
        : "Contest";

  const classes = (() => {
    if (selected && action === "acknowledged") {
      return "bg-brand-700 text-white ring-brand-800/20 shadow-sm";
    }
    if (selected && action === "questioned") {
      return "bg-amber-100 text-amber-900 ring-amber-300 shadow-sm";
    }
    if (selected && action === "contested") {
      return "bg-rose-700 text-white ring-rose-800/20 shadow-sm";
    }
    if (action === "contested") {
      return "bg-rose-50 text-rose-800 ring-rose-200/90 hover:bg-rose-100";
    }
    return "bg-white text-ink-800 ring-ink-200/90 hover:bg-ink-50";
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium ring-1 ring-inset transition-all active:translate-y-px ${classes}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function speakerDotClass(author?: string) {
  if (author?.includes("Andrea")) return "bg-sky-600";
  if (author?.includes("Management")) return "bg-violet-600";
  if (author?.includes("Diego")) return "bg-amber-600";
  return "bg-brand-700";
}

type ReviewActionForButton = Exclude<StoredReviewAction, "unreviewed">;

export function mergeStoredActions(rows: MathAnnotation[], snapshot: string) {
  const stored = mergeStoredReviewState(rows, snapshot);
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      stored[row.id]?.action ?? row.reviewAction ?? "unreviewed",
    ]),
  ) as Record<string, StoredReviewAction>;
}

export function mergeStoredReviewState(
  rows: MathAnnotation[],
  snapshot: string,
) {
  const stored = parseReviewState(snapshot);
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        action: stored[row.id]?.action ?? row.reviewAction ?? "unreviewed",
        note: stored[row.id]?.note ?? "",
        noteAuthor: stored[row.id]?.noteAuthor ?? "",
        noteDraft: stored[row.id]?.noteDraft ?? "",
        venueResponse: stored[row.id]?.venueResponse ?? "",
        venueResponseDraft: stored[row.id]?.venueResponseDraft ?? "",
        reviewerFollowUps:
          stored[row.id]?.reviewerFollowUps ??
          (stored[row.id]?.reviewerFollowUp
            ? [stored[row.id].reviewerFollowUp]
            : []),
        reviewerFollowUp: stored[row.id]?.reviewerFollowUp ?? "",
        reviewerFollowUpAuthors: stored[row.id]?.reviewerFollowUpAuthors ?? [],
        reviewerFollowUpDraft: stored[row.id]?.reviewerFollowUpDraft ?? "",
        resolutionAccepted: stored[row.id]?.resolutionAccepted ?? false,
        reviewerPositionAccepted:
          stored[row.id]?.reviewerPositionAccepted ?? false,
      },
    ]),
  ) as StoredReviewState;
}

export function readReviewActionsSnapshot(storageKey: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(storageKey) ?? "";
}

export function subscribeToReviewActions(
  storageKey: string,
  onStoreChange: () => void,
) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(storageKey, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(storageKey, onStoreChange);
  };
}

function ActionBadge({ action }: { action: StoredReviewAction }) {
  if (action === "acknowledged") {
    return <PlainBadge variant="brand">{ACTION_LABELS[action]}</PlainBadge>;
  }
  if (action === "questioned") {
    return <PlainBadge variant="amber">{ACTION_LABELS[action]}</PlainBadge>;
  }
  if (action === "contested") {
    return <PlainBadge variant="rose">{ACTION_LABELS[action]}</PlainBadge>;
  }
  return <PlainBadge>{ACTION_LABELS[action]}</PlainBadge>;
}

function parseReviewState(snapshot: string): StoredReviewState {
  if (!snapshot) return {};
  try {
    const parsed = JSON.parse(snapshot);
    if (typeof parsed !== "object" || parsed == null) return {};

    // Backwards-compatible read for the earlier prototype shape:
    // { [rowId]: "questioned" }.
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => {
        if (typeof value === "string") {
          return [key, { action: value, note: "" }];
        }
        if (typeof value === "object" && value != null) {
          const item = value as Partial<StoredReviewItem>;
          return [
            key,
            {
              action: item.action ?? "unreviewed",
              note: item.note ?? "",
              noteAuthor: item.noteAuthor ?? "",
              noteDraft: item.noteDraft ?? "",
              venueResponse: item.venueResponse ?? "",
              venueResponseDraft: item.venueResponseDraft ?? "",
              reviewerFollowUps:
                item.reviewerFollowUps ??
                (item.reviewerFollowUp ? [item.reviewerFollowUp] : []),
              reviewerFollowUp: item.reviewerFollowUp ?? "",
              reviewerFollowUpAuthors: item.reviewerFollowUpAuthors ?? [],
              reviewerFollowUpDraft: item.reviewerFollowUpDraft ?? "",
              resolutionAccepted: item.resolutionAccepted ?? false,
              reviewerPositionAccepted: item.reviewerPositionAccepted ?? false,
            },
          ];
        }
        return [key, { action: "unreviewed", note: "" }];
      }),
    ) as StoredReviewState;
  } catch {
    return {};
  }
}

function submittedReplies(item: StoredReviewItem | undefined): string[] {
  if (!item) return [];
  return item.reviewerFollowUps ?? (item.reviewerFollowUp ? [item.reviewerFollowUp] : []);
}

export function writeReviewState(
  storageKey: string,
  actions: StoredReviewState,
) {
  window.localStorage.setItem(storageKey, JSON.stringify(actions));
  window.dispatchEvent(new Event(storageKey));
}
