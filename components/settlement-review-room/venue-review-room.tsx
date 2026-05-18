"use client";

import type React from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlainBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type {
  MathAnnotation,
  ReviewConfidence,
  ReviewSeverity,
  SettlementReviewRoom,
  StoredReviewAction,
  StoredReviewState,
} from "@/lib/settlementReviewRoom";
import { reviewActionStorageKey } from "@/lib/settlementReviewRoom";
import {
  mergeStoredActions,
  mergeStoredReviewState,
  readReviewActionsSnapshot,
  subscribeToReviewActions,
  writeReviewState,
} from "@/app/shows/[id]/review/review-actions";
import {
  ExpectedPayoutReadout,
} from "@/app/shows/[id]/review/financial-summary";

type ReviewRoomSection = "overview" | "language" | "math" | "activity";

export function VenueReviewRoom({
  room,
  showId,
  totalToArtist,
  defaultExpectedAmount,
}: {
  room: SettlementReviewRoom;
  showId: string;
  totalToArtist?: number | null;
  defaultExpectedAmount?: number | null;
}) {
  const storageKey = reviewActionStorageKey(showId);
  const snapshot = useSyncExternalStore(
    (onStoreChange) => subscribeToReviewActions(storageKey, onStoreChange),
    () => readReviewActionsSnapshot(storageKey),
    () => "",
  );
  const actions = useMemo(
    () => mergeStoredActions(room.mathAnnotations, snapshot),
    [room.mathAnnotations, snapshot],
  );
  const reviewState = useMemo(
    () => mergeStoredReviewState(room.mathAnnotations, snapshot),
    [room.mathAnnotations, snapshot],
  );
  const actionValues = Object.values(actions);
  const contestedCount = actionValues.filter(
    (action) => action === "contested",
  ).length;
  const questionedCount = actionValues.filter(
    (action) => action === "questioned",
  ).length;
  const acknowledgedCount = actionValues.filter(
    (action) => action === "acknowledged",
  ).length;
  const resolvedCount = Object.values(reviewState).filter(
    (item) => item.resolutionAccepted,
  ).length;
  const openCount = contestedCount + questionedCount;
  const [activeSection, setActiveSection] =
    useState<ReviewRoomSection>("overview");
  const reviewPath = `/shows/${showId}/review`;
  const [shareUrl, setShareUrl] = useState(reviewPath);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const syncedReadiness =
    contestedCount > 0
      ? "contested"
      : questionedCount > 0
        ? "review_needed"
        : acknowledgedCount > 0
          ? "ready"
          : room.readiness;
  const ambiguousLanguage = room.interpretations.filter(
    (interpretation) => interpretation.confidence === "low",
  );
  const attentionFlags = room.flags.filter((flag) => flag.severity !== "info");

  useEffect(() => {
    setShareUrl(`${window.location.origin}${reviewPath}`);
  }, [reviewPath]);

  const copyShareUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopiedShareUrl(true);
    window.setTimeout(() => setCopiedShareUrl(false), 1800);
  };

  return (
    <Card accent={syncedReadiness === "contested" ? "rose" : "brand"}>
      <CardHeader className="flex-col items-stretch gap-4 px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-brand-700" />
              <CardTitle className="text-[15px]">
                Settlement Review Room
              </CardTitle>
              <ReadinessBadge readiness={syncedReadiness} />
            </div>
            <CardDescription>
              Mariana&apos;s workspace for reviewing shared deal terms, AI flags, and
              reviewer responses. Venue-only notes stay internal; the shared link
              shows the terms, math, and resolution thread.
            </CardDescription>
          </div>
        </div>

        <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 p-2">
          <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">
            Share Review Link
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              aria-label="Review page share URL"
              className="h-8 min-w-0 flex-1 truncate rounded-md border border-ink-200/80 bg-white px-3 font-mono text-[11px] text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 shrink-0"
              onClick={copyShareUrl}
            >
              {copiedShareUrl ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedShareUrl ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 py-5">
        <div className="flex flex-wrap gap-2 rounded-lg bg-canvas-soft ring-1 ring-ink-200/60 p-2">
          <SectionTab
            active={activeSection === "overview"}
            onClick={() => setActiveSection("overview")}
          >
            Overview
          </SectionTab>
          <SectionTab
            active={activeSection === "language"}
            onClick={() => setActiveSection("language")}
          >
            Language & Flags
          </SectionTab>
          <SectionTab
            active={activeSection === "math"}
            onClick={() => setActiveSection("math")}
          >
            Math
          </SectionTab>
          <SectionTab
            active={activeSection === "activity"}
            onClick={() => setActiveSection("activity")}
          >
            Reviewer Activity
          </SectionTab>
        </div>

        {activeSection === "overview" && (
        <div className="grid grid-cols-1 items-start lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
          <div className="rounded-lg bg-brand-50/30 ring-1 ring-brand-200/60 p-5">
            <div className="eyebrow text-[10px] text-brand-800 mb-3">
              AI Interpretation
            </div>
            <p className="max-w-2xl text-[13px] text-ink-800 leading-6">
              {room.summary}
            </p>
          </div>

          <div className="rounded-lg bg-white ring-1 ring-ink-200/70 p-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-5">
              <div>
                <div className="eyebrow text-[10px] text-ink-500 mb-1.5">
                  Review Status
                </div>
                <div className="text-[15px] font-semibold text-ink-900 leading-tight">
                  {reviewerStatusHeadline(syncedReadiness)}
                </div>
                <div className="mt-1 text-[12px] text-ink-500 leading-relaxed">
                  {reviewerStatusDetail({
                    readiness: syncedReadiness,
                    openCount,
                    resolvedCount,
                    acknowledgedCount,
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="eyebrow text-[9px] text-brand-800 mb-1">
                  Proposed To Artist
                </div>
                <div className="font-mono tabular text-[22px] font-semibold text-ink-900 leading-none">
                  {formatMoney(totalToArtist)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ReviewStatePill label="Open" value={openCount} tone={openCount > 0 ? "rose" : "neutral"} />
              <ReviewStatePill label="Resolved" value={resolvedCount} tone="amber" />
              <ReviewStatePill label="Acknowledged" value={acknowledgedCount} tone="brand" />
            </div>

            <div>
              <ExpectedPayoutReadout
                showId={showId}
                proposedAmount={totalToArtist}
                defaultExpectedAmount={defaultExpectedAmount}
              />
            </div>
            </div>
          </div>
        </div>
        )}

        {activeSection === "language" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div>
            <SectionEyebrow>Ambiguous Language</SectionEyebrow>
            <div className="space-y-3">
              {ambiguousLanguage.map((interpretation) => (
                <div
                  key={interpretation.id}
                  className="rounded-lg border border-ink-200/70 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-ink-900">
                        {interpretation.topic}
                      </div>
                      <div className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                        {interpretation.reasoning}
                      </div>
                    </div>
                    <ConfidenceBadge confidence={interpretation.confidence} />
                  </div>
                  <div className="mt-3 grid gap-3">
                    <ArtifactQuote
                      label="Mariana's Deal Summary"
                      value={interpretation.originalText}
                    />
                    <ArtifactQuote
                      label="Greenroom Interpretation To Confirm"
                      value={interpretation.proposedMeaning}
                      emphasis
                    />
                  </div>
                </div>
              ))}
              {ambiguousLanguage.length === 0 && (
                <EmptyReviewState>
                  No ambiguous language needs alignment right now.
                </EmptyReviewState>
              )}
            </div>
          </div>

          <div>
            <SectionEyebrow>Needs Alignment</SectionEyebrow>
            <div className="space-y-3">
              {attentionFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="rounded-lg border border-ink-200/70 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[13px] font-semibold text-ink-900">
                      {flag.title}
                    </div>
                    <SeverityBadge severity={flag.severity} />
                  </div>
                  <div className="mt-3 rounded-md bg-canvas-soft px-3 py-2 text-[12px] text-ink-700 leading-relaxed">
                    <span className="font-medium text-ink-900">
                      {flag.id === "unsupported-engine"
                        ? "Structured Deal Type:"
                        : "Source Language:"}
                    </span>{" "}
                    {flag.evidence}
                  </div>
                  <div className="mt-3 text-[12px] text-ink-600 leading-relaxed">
                    <span className="font-medium text-ink-900">
                      Greenroom Flag:
                    </span>{" "}
                    {flag.whyItMatters}
                  </div>
                  <div className="mt-2 rounded-md bg-brand-50/40 px-3 py-2 text-[12px] text-brand-800 leading-relaxed">
                    <span className="font-medium">Next Step:</span>{" "}
                    {flag.suggestedResolution}
                  </div>
                </div>
              ))}
              {attentionFlags.length === 0 && (
                <EmptyReviewState>
                  No confusing assumptions or alignment flags are open.
                </EmptyReviewState>
              )}
            </div>
          </div>
        </div>
        )}

        {activeSection === "math" && (
          <MathTrace rows={room.mathAnnotations} actions={actions} />
        )}

        {activeSection === "activity" && (
          <ReviewerActivity
            room={room}
            actions={actions}
            reviewState={reviewState}
            storageKey={storageKey}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SectionTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors ${
        active
          ? "bg-brand-700 text-white ring-brand-700"
          : "bg-white text-ink-600 ring-ink-200/70 hover:text-ink-900 hover:ring-brand-200"
      }`}
    >
      {children}
    </button>
  );
}

function MathTrace({
  rows,
  actions,
}: {
  rows: MathAnnotation[];
  actions: Record<string, StoredReviewAction>;
}) {
  return (
    <div id="review-math" className="scroll-mt-6">
      <SectionEyebrow>Explain The Math</SectionEyebrow>
      <div className="rounded-lg border border-ink-200/70 bg-white divide-y divide-ink-100/80">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-ink-900">
                  {row.label}
                </span>
                <ActionBadge action={actions[row.id] ?? row.reviewAction ?? "unreviewed"} />
              </div>
              <div className="text-[11.5px] text-ink-400 mt-0.5">
                {row.source}
              </div>
              <div className="text-[12px] text-ink-600 mt-1 leading-relaxed">
                {row.rationale}
              </div>
            </div>
            <div className="font-mono tabular text-[13.5px] text-ink-900 text-right">
              {row.value == null ? "—" : formatMoney(row.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewStatePill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "brand" | "amber" | "rose";
}) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
      : tone === "brand"
        ? "bg-brand-50 text-brand-800 ring-brand-200"
        : "bg-canvas-soft text-ink-600 ring-ink-200";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] ring-1 ${toneClass}`}
    >
      <span className="font-mono tabular font-semibold">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function ReviewerActivity({
  room,
  actions,
  reviewState,
  storageKey,
}: {
  room: SettlementReviewRoom;
  actions: Record<string, StoredReviewAction>;
  reviewState: StoredReviewState;
  storageKey: string;
}) {
  const reviewerUpdates = Object.entries(actions).filter(
    ([, action]) => action !== "unreviewed",
  );
  const [submittedResponses, setSubmittedResponses] = useState<
    Record<string, boolean>
  >({});
  const reviewItems = room.mathAnnotations.map(
    (row) =>
      [
        row.id,
        reviewState[row.id] ?? {
          action: row.reviewAction ?? "unreviewed",
          reviewerFollowUps: [],
        },
      ] as const,
  );

  const updateVenueResponse = (itemId: string, venueResponseDraft: string) => {
    setSubmittedResponses((current) => ({ ...current, [itemId]: false }));
    writeReviewState(storageKey, {
      ...reviewState,
      [itemId]: {
        action: reviewState[itemId]?.action ?? "unreviewed",
        note: reviewState[itemId]?.note ?? "",
        noteDraft: reviewState[itemId]?.noteDraft ?? "",
        reviewerFollowUps: reviewState[itemId]?.reviewerFollowUps ?? [],
        reviewerFollowUp: reviewState[itemId]?.reviewerFollowUp ?? "",
        reviewerFollowUpDraft:
          reviewState[itemId]?.reviewerFollowUpDraft ?? "",
        resolutionAccepted: reviewState[itemId]?.resolutionAccepted ?? false,
        reviewerPositionAccepted:
          reviewState[itemId]?.reviewerPositionAccepted ?? false,
        venueResponse: reviewState[itemId]?.venueResponse ?? "",
        venueResponseDraft,
      },
    });
  };

  const submitVenueResponse = (itemId: string) => {
    const draft = reviewState[itemId]?.venueResponseDraft?.trim();
    if (!draft) return;
    writeReviewState(storageKey, {
      ...reviewState,
      [itemId]: {
        ...reviewState[itemId],
        venueResponse: draft,
        venueResponseDraft: "",
      },
    });
    setSubmittedResponses((current) => ({ ...current, [itemId]: true }));
  };

  const acceptReviewerPosition = (itemId: string) => {
    const label = labelForItem(room.mathAnnotations, itemId);
    writeReviewState(storageKey, {
      ...reviewState,
      [itemId]: {
        ...reviewState[itemId],
        action: "acknowledged",
        reviewerPositionAccepted: true,
        resolutionAccepted: true,
        venueResponse:
          reviewState[itemId]?.venueResponseDraft?.trim() ||
          reviewState[itemId]?.venueResponse?.trim() ||
          `Venue accepted the reviewer position on "${label}" and will carry that interpretation into the final settlement.`,
        venueResponseDraft: "",
      },
    });
    setSubmittedResponses((current) => ({ ...current, [itemId]: true }));
  };

  const reopenResolution = (itemId: string) => {
    writeReviewState(storageKey, {
      ...reviewState,
      [itemId]: {
        ...reviewState[itemId],
        action:
          reviewState[itemId]?.action === "acknowledged"
            ? "questioned"
            : reviewState[itemId]?.action ?? "questioned",
        resolutionAccepted: false,
        reviewerPositionAccepted: false,
      },
    });
  };

  const proposeStandardResolution = (itemId: string) => {
    const label = labelForItem(room.mathAnnotations, itemId);
    updateVenueResponse(
      itemId,
      `Proposed resolution: align on "${label}" in this artifact before signoff. Mariana will update the final settlement statement to match this interpretation and keep this note attached as the paper trail.`,
    );
  };

  return (
    <div id="review-activity" className="scroll-mt-6">
      <SectionEyebrow>Reviewer Activity</SectionEyebrow>
      <div className="rounded-lg border border-ink-200/70 bg-white">
        <div>
          {reviewItems.length === 0 && (
            <div className="p-4 text-[12.5px] text-ink-600 leading-relaxed">
              No live reviewer activity yet. Open the shared view to add
              questions, notes, contests, or acknowledgements.
            </div>
          )}
          {reviewItems.length > 0 && (
            <div className="divide-y divide-ink-100/80">
                {reviewItems.map(([itemId, item]) => (
                  <VenueActivityItem
                    key={itemId}
                    itemId={itemId}
                    item={item}
                    row={rowForItem(room.mathAnnotations, itemId)}
                    submittedResponse={submittedResponses[itemId]}
                    onReopen={() => reopenResolution(itemId)}
                    onVenueResponseChange={(value) =>
                      updateVenueResponse(itemId, value)
                    }
                    onSubmitVenueResponse={() => submitVenueResponse(itemId)}
                    onAcceptReviewerPosition={() =>
                      acceptReviewerPosition(itemId)
                    }
                    onProposeStandardResolution={() =>
                      proposeStandardResolution(itemId)
                    }
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VenueActivityItem({
  itemId,
  item,
  row,
  submittedResponse,
  onReopen,
  onVenueResponseChange,
  onSubmitVenueResponse,
  onAcceptReviewerPosition,
  onProposeStandardResolution,
}: {
  itemId: string;
  item: StoredReviewState[string];
  row: MathAnnotation | undefined;
  submittedResponse: boolean | undefined;
  onReopen: () => void;
  onVenueResponseChange: (value: string) => void;
  onSubmitVenueResponse: () => void;
  onAcceptReviewerPosition: () => void;
  onProposeStandardResolution: () => void;
}) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink-900">
              {row?.label ?? itemId}
            </span>
            {item.resolutionAccepted && (
              <PlainBadge variant="brand">Accepted resolution</PlainBadge>
            )}
            {item.reviewerPositionAccepted && (
              <PlainBadge variant="brand">Reviewer position accepted</PlainBadge>
            )}
          </div>
          {row?.rationale && (
            <div className="text-[12px] text-ink-500 mt-1 leading-relaxed">
              {row.rationale}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="font-mono tabular text-[13.5px] font-semibold text-ink-900">
            {row?.value == null ? "—" : formatMoney(row.value)}
          </div>
          <ActionBadge action={item.action} />
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-brand-50/30 ring-1 ring-brand-200/60 p-3">
        <details open>
          <summary className="cursor-pointer text-[12px] font-medium text-ink-900">
            Thread with reviewer
          </summary>
          <div className="mt-3 space-y-3 border-l-2 border-brand-200/70 pl-3">
            {!item.note?.trim() &&
              !item.venueResponse?.trim() &&
              submittedReplies(item).length === 0 && (
                <div className="relative rounded-md bg-white/90 ring-1 ring-brand-200/60 px-3 py-2">
                  <span className="absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full bg-brand-700 ring-2 ring-white" />
                  <div className="eyebrow text-[9px] text-brand-800 mb-1">
                    Reviewer Context
                  </div>
                  <div className="text-[12.5px] text-ink-500 leading-relaxed">
                    No note submitted for this line yet.
                  </div>
                </div>
              )}

            {item.note?.trim() && (
              <ThreadMessage
                speaker={item.noteAuthor || "Reviewer"}
                label="Reviewer note"
              >
                {item.note}
              </ThreadMessage>
            )}

            {item.venueResponse?.trim() && (
              <ThreadMessage speaker="Mariana Reyes" label="Venue response">
                {item.venueResponse}
              </ThreadMessage>
            )}

            {submittedReplies(item).map((reply, index) => (
              <ThreadMessage
                key={`${itemId}-follow-up-${index}`}
                speaker={item.reviewerFollowUpAuthors?.[index] || "Reviewer"}
                label={`Reviewer reply ${index + 1}`}
              >
                {reply}
              </ThreadMessage>
            ))}

            {item.resolutionAccepted && (
              <div className="rounded-md bg-brand-50/70 ring-1 ring-brand-200/70 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PlainBadge variant="brand">Accepted resolution</PlainBadge>
                  <span className="text-[12px] text-ink-700">
                    This line is closed for signoff.
                  </span>
                  <button
                    type="button"
                    onClick={onReopen}
                    className="text-[11.5px] font-medium text-brand-700 hover:text-brand-800"
                  >
                    Reopen
                  </button>
                </div>
              </div>
            )}

            {!item.resolutionAccepted && (
              <>
                <div>
                  <label
                    htmlFor={`venue-response-${itemId}`}
                    className="eyebrow text-[9px] text-ink-500 mb-1.5 block"
                  >
                    Response
                  </label>
                  <textarea
                    id={`venue-response-${itemId}`}
                    value={item.venueResponseDraft ?? ""}
                    onChange={(event) =>
                      onVenueResponseChange(event.target.value)
                    }
                    placeholder="Reply or propose a resolution..."
                    rows={3}
                    className="w-full rounded-lg border border-ink-200/80 bg-white px-3 py-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-300"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onProposeStandardResolution}
                    className="text-[11.5px] font-medium text-brand-700 hover:text-brand-800"
                  >
                    Suggest reply
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onSubmitVenueResponse}
                    disabled={!item.venueResponseDraft?.trim()}
                  >
                    Send
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="brand"
                    onClick={onAcceptReviewerPosition}
                    disabled={!item.note?.trim()}
                  >
                    Accept position
                  </Button>
                  {submittedResponse && (
                    <PlainBadge variant="brand">Sent to reviewer</PlainBadge>
                  )}
                  </div>
                </div>
              </>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

function ThreadMessage({
  speaker,
  label,
  children,
}: {
  speaker: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-md bg-white/90 ring-1 ring-brand-200/60 px-3 py-2">
      <span
        className={`absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
          speakerDotClass(speaker)
        }`}
      />
      <div className="eyebrow text-[9px] text-brand-800 mb-1">
        {speaker} · {label}
      </div>
      <div className="text-[12.5px] text-ink-800 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function speakerDotClass(speaker?: string) {
  if (speaker?.includes("Mariana")) return "bg-amber-500";
  if (speaker?.includes("Andrea")) return "bg-sky-600";
  if (speaker?.includes("Management")) return "bg-violet-600";
  if (speaker?.includes("Diego")) return "bg-amber-600";
  return "bg-brand-700";
}

function rowForItem(rows: MathAnnotation[], itemId: string) {
  return rows.find((row) => row.id === itemId);
}

function ArtifactQuote({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-md p-3 ring-1 ${
        emphasis
          ? "bg-brand-50/40 ring-brand-200/60"
          : "bg-canvas-soft ring-ink-200/60"
      }`}
    >
      <div className="eyebrow text-[9px] text-ink-500 mb-1">{label}</div>
      <div className="text-[12.5px] text-ink-800 leading-relaxed">{value}</div>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow text-[10px] text-ink-500 mb-3">{children}</div>
  );
}

function EmptyReviewState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-200/80 bg-white/70 p-4 text-[12.5px] text-ink-500 leading-relaxed">
      {children}
    </div>
  );
}

function ReadinessBadge({
  readiness,
}: {
  readiness: SettlementReviewRoom["readiness"];
}) {
  if (readiness === "contested") {
    return <PlainBadge variant="rose">Contested</PlainBadge>;
  }
  if (readiness === "review_needed") {
    return <PlainBadge variant="amber">Needs alignment</PlainBadge>;
  }
  return <PlainBadge variant="brand">Review ready</PlainBadge>;
}

function ConfidenceBadge({ confidence }: { confidence: ReviewConfidence }) {
  const variant =
    confidence === "high" ? "brand" : confidence === "medium" ? "amber" : "rose";
  const label =
    confidence === "high"
      ? "Clear"
      : confidence === "medium"
        ? "Review assumption"
        : "Ambiguous";
  return <PlainBadge variant={variant}>{label}</PlainBadge>;
}

function SeverityBadge({ severity }: { severity: ReviewSeverity }) {
  if (severity === "needs_alignment") {
    return <PlainBadge variant="rose">Needs alignment</PlainBadge>;
  }
  if (severity === "watch") {
    return <PlainBadge variant="amber">Watch</PlainBadge>;
  }
  return <PlainBadge variant="sky">Info</PlainBadge>;
}

function ActionBadge({ action }: { action: StoredReviewAction }) {
  if (action === "unreviewed") {
    return <PlainBadge>Unreviewed</PlainBadge>;
  }
  const variant =
    action === "acknowledged" ? "brand" : action === "questioned" ? "amber" : "rose";
  const label =
    action === "acknowledged"
      ? "Acknowledged"
      : action === "questioned"
        ? "Questioned"
        : "Contested";
  return <PlainBadge variant={variant}>{label}</PlainBadge>;
}

function labelForItem(rows: MathAnnotation[], itemId: string) {
  return rows.find((row) => row.id === itemId)?.label ?? itemId;
}

function submittedReplies(item: StoredReviewState[string]): string[] {
  return item.reviewerFollowUps ?? (item.reviewerFollowUp ? [item.reviewerFollowUp] : []);
}

function reviewerStatusHeadline(readiness: SettlementReviewRoom["readiness"]) {
  if (readiness === "contested") {
    return "Needs Response";
  }
  if (readiness === "review_needed") {
    return "Needs Alignment";
  }
  return "Ready For Signoff";
}

function reviewerStatusDetail({
  readiness,
  openCount,
  resolvedCount,
  acknowledgedCount,
}: {
  readiness: SettlementReviewRoom["readiness"];
  openCount: number;
  resolvedCount: number;
  acknowledgedCount: number;
}) {
  if (readiness === "contested") {
    return `${openCount} open item${openCount === 1 ? "" : "s"} require venue review.`;
  }
  if (readiness === "review_needed") {
    return `${openCount} question${openCount === 1 ? "" : "s"} need alignment before signoff.`;
  }
  if (resolvedCount > 0) {
    return `${resolvedCount} resolved, ${acknowledgedCount} acknowledged.`;
  }
  return `${acknowledgedCount} acknowledged, no open reviewer issues.`;
}
