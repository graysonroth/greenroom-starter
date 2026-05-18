import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Link2,
  Sparkles,
} from "lucide-react";
import { getShowById } from "@/lib/queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DealTypeBadge, PlainBadge, StatusBadge } from "@/components/ui/badge";
import { calculateSettlement, parseBonuses } from "@/lib/dealMath";
import { formatMoney, formatShowDateFull } from "@/lib/format";
import { buildSettlementReviewRoom } from "@/lib/settlementReviewRoom";
import { DifferenceToAlignCard, FinancialSummary } from "./financial-summary";
import { ReviewerActions } from "./review-actions";
import { SharedReviewTabs } from "./shared-review-tabs";

export default async function ReviewerPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data || !data.deal) notFound();

  const {
    show,
    artist,
    deal,
    settlement,
    ticketSales,
    expenses,
    comps,
    recoups,
  } = data;
  const calc = calculateSettlement({
    deal,
    ticketSales,
    expenses,
    venueCapacity: data.venue?.capacity ?? undefined,
  });
  const room = buildSettlementReviewRoom({
    show,
    deal,
    settlement,
    calc,
    ticketSales,
    expenses,
    comps,
    recoups,
  });
  const totalToArtist = calc.supported
    ? calc.totalToArtist
    : settlement?.totalToArtist;
  const urgentFlags = room.flags.filter(
    (flag) => flag.severity !== "info",
  );
  const bonuses = parseBonuses(deal);

  return (
    <div className="px-12 py-10 max-w-7xl">
      <Link
        href={`/shows/${show.id}/review-room`}
        className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to internal Review Room
      </Link>

      <div className="rounded-2xl bg-gradient-to-b from-brand-50/60 to-white border border-brand-200/70 px-8 py-8 mb-6">
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <StatusBadge status={show.status} />
          <DealTypeBadge type={deal.dealType} />
          <PlainBadge variant="brand">Shared View</PlainBadge>
          <PlainBadge variant="sky" className="gap-1">
            <Link2 className="h-3 w-3" />
            Same Review Room Artifact
          </PlainBadge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-end">
          <div className="min-w-0">
            <div className="eyebrow text-[10px] text-brand-800 mb-2">
              Settlement Review Room
            </div>
            <h1
              className="font-display text-[44px] font-medium text-ink-900 leading-[1.05]"
              style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}
            >
              Shared Review Room · {artist?.name ?? "Artist"}
            </h1>
            <div className="text-[13px] text-ink-500 mt-3">
              {formatShowDateFull(show.date)} · Reviewer-facing breakdown with
              shared deal terms included
            </div>
          </div>
          <FinancialSummary
            showId={show.id}
            proposedAmount={totalToArtist}
            defaultExpectedAmount={room.financialDelta?.reviewerRead}
          />
        </div>
      </div>

      <SharedReviewTabs
        dealTerms={
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Shared Deal Terms</CardTitle>
            <CardDescription>
              The structured deal summary and negotiated email language Mariana
              entered on the show. In this prototype, Greenroom&apos;s AI summary is
              generated in-app from those inputs; no live model or API key is
              required.
            </CardDescription>
          </div>
          <DealTypeBadge type={deal.dealType} />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <DealTerm label="Guarantee" value={formatMoney(deal.guaranteeAmount)} />
            <DealTerm
              label="Percentage"
              value={
                deal.percentage != null
                  ? `${(deal.percentage * 100).toFixed(0)}% ${deal.percentageBasis ? `of ${deal.percentageBasis}` : ""}`
                  : "—"
              }
            />
            <DealTerm label="Expense Cap" value={formatMoney(deal.expenseCap)} />
            <DealTerm
              label="Hospitality Cap"
              value={formatMoney(deal.hospitalityCap)}
            />
          </div>

          {bonuses.length > 0 && (
            <div className="rounded-lg ring-1 ring-brand-200/50 bg-brand-50/20 p-4">
              <div className="eyebrow text-[10px] text-brand-800 mb-2">
                Bonuses & Escalators
              </div>
              <ul className="space-y-2">
                {bonuses.map((bonus, index) => (
                  <li
                    key={`${bonus.type}-${index}`}
                    className="text-[12.5px] text-ink-800 leading-relaxed"
                  >
                    {bonus.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {room.rewrites.map((rewrite) => (
            <div
              key={rewrite.id}
              className="space-y-3"
            >
              <div className="space-y-2">
                <div className="eyebrow text-[10px] text-ink-500">
                  Shared Deal Language From Email
                </div>
                <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/60 p-4">
                  <div className="text-[13px] text-ink-800 leading-relaxed font-[450] italic">
                    {rewrite.originalText}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="eyebrow text-[10px] text-brand-800">
                  AI-Generated Shared Summary
                </div>
                <div className="rounded-lg bg-brand-50/30 ring-1 ring-brand-200/60 p-4">
                  <div className="text-[13px] text-ink-800 leading-relaxed">
                    {rewrite.aiGeneratedSummary}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
        }
        reviewFocus={

      <Card accent={room.readiness === "contested" ? "rose" : "brand"}>
          <CardHeader>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-700" />
                <CardTitle>Review Focus</CardTitle>
              </div>
              <CardDescription>
                The quickest read of what needs a reviewer decision before
                signoff.
              </CardDescription>
            </div>
            <ReadinessBadge readiness={room.readiness} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/60 p-4">
                <div className="eyebrow text-[9px] text-ink-500 mb-1">
                  Primary Issue
                </div>
                <div className="text-[15px] font-semibold text-ink-900">
                  {urgentFlags[0]?.title ?? "No open alignment issue"}
                </div>
                <p className="mt-2 text-[12.5px] text-ink-600 leading-relaxed">
                  {urgentFlags[0]?.whyItMatters ??
                    "Greenroom did not find an ambiguous deal term that changes the payout."}
                </p>
              </div>

              <DifferenceToAlignCard
                showId={show.id}
                proposedAmount={totalToArtist}
                defaultExpectedAmount={room.financialDelta?.reviewerRead}
              />
            </div>

            <div className="rounded-lg bg-brand-50/30 ring-1 ring-brand-200/60 p-4">
              <div className="eyebrow text-[9px] text-brand-800 mb-1">
                Next Step
              </div>
              <div className="text-[12.5px] text-ink-800 leading-relaxed">
                {urgentFlags[0]?.suggestedResolution ??
                  "Review the math and mark the settlement ready for signoff."}
              </div>
            </div>

            <div>
              <div className="eyebrow text-[9px] text-ink-500 mb-2">
                Needs Attention
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(urgentFlags.length > 0 ? urgentFlags : room.flags).map((flag) => (
                  <div
                    key={flag.id}
                    className="rounded-lg border border-ink-200/70 bg-white p-3"
                  >
                    <div className="text-[12.5px] font-semibold text-ink-900">
                      {flag.title}
                    </div>
                    <div className="mt-1.5 text-[12px] text-ink-500 leading-relaxed">
                      {flag.suggestedResolution}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        }
        math={

        <Card>
          <CardHeader>
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-700" />
                <CardTitle>Settlement Math</CardTitle>
              </div>
              <CardDescription>
                Read-only calculation trace before adding review notes or
                questions.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ReadOnlyMath rows={room.mathAnnotations} />
          </CardContent>
        </Card>
        }
        review={

        <Card>
          <CardHeader>
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-700" />
                <CardTitle>Review Line Items</CardTitle>
              </div>
              <CardDescription>
                Acknowledge clean lines or start a thread with the venue.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ReviewerActions
              rows={room.mathAnnotations}
              showId={show.id}
              proposedAmount={totalToArtist}
              defaultExpectedAmount={room.financialDelta?.reviewerRead}
            />
          </CardContent>
        </Card>
        }
        resolution={

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Resolution Language</CardTitle>
              <CardDescription>
                AI-proposed wording both sides can use to clarify the shared
                terms before final signoff.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {room.rewrites.map((rewrite) => (
              <div key={rewrite.id} className="space-y-3">
                <div className="rounded-lg bg-brand-50/30 ring-1 ring-brand-200/60 p-4">
                  <div className="eyebrow text-[9px] text-brand-800 mb-1">
                    Proposed Resolution Language
                  </div>
                  <div className="text-[12.5px] text-ink-800 leading-relaxed">
                    {rewrite.suggestedText}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        }
      />
    </div>
  );
}

function ReadinessBadge({
  readiness,
}: {
  readiness: "ready" | "review_needed" | "contested";
}) {
  if (readiness === "contested") {
    return <PlainBadge variant="rose">Contested</PlainBadge>;
  }
  if (readiness === "review_needed") {
    return <PlainBadge variant="amber">Needs alignment</PlainBadge>;
  }
  return <PlainBadge variant="brand">Ready</PlainBadge>;
}

function DealTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow text-[10px] text-brand-800 mb-1.5">{label}</div>
      <div className="font-mono tabular text-[15px] text-ink-900">{value}</div>
    </div>
  );
}

function ReadOnlyMath({
  rows,
}: {
  rows: ReturnType<typeof buildSettlementReviewRoom>["mathAnnotations"];
}) {
  return (
    <div className="rounded-lg border border-ink-200/70 bg-white divide-y divide-ink-100/80">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3"
        >
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink-900">
              {row.label}
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
  );
}

