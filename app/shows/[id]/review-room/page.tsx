import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, FileSpreadsheet } from "lucide-react";
import { getShowById } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { DealTypeBadge, PlainBadge, StatusBadge } from "@/components/ui/badge";
import { calculateSettlement } from "@/lib/dealMath";
import { formatShowDateFull } from "@/lib/format";
import { buildSettlementReviewRoom } from "@/lib/settlementReviewRoom";
import { VenueReviewRoom } from "@/components/settlement-review-room/venue-review-room";
import { FinancialSummary } from "../review/financial-summary";
import { ResetReviewDemoButton } from "./reset-demo-button";

export default async function ReviewRoomPage({
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
    ticketSales,
    expenses,
    settlement,
    recoups,
    comps,
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

  return (
    <div className="px-12 py-10 max-w-7xl">
      <Link
        href={`/shows/${show.id}`}
        className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to show
      </Link>

      <div className="mb-3 flex justify-end">
        <ResetReviewDemoButton showId={show.id} />
      </div>

      <div className="mb-10 rounded-2xl border border-brand-200/70 bg-gradient-to-b from-brand-50/50 to-white px-8 py-7">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-4">
              <StatusBadge status={show.status} />
              <DealTypeBadge type={deal.dealType} />
              <PlainBadge variant="brand">Mariana Workspace</PlainBadge>
              <PlainBadge variant="sky">Shared Terms Visible To Reviewer</PlainBadge>
            </div>
            <h1
              className="font-display text-[48px] font-medium text-ink-900 leading-[1.05]"
              style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}
            >
              Internal Review Room · {artist?.name}
            </h1>
            <div className="text-[14px] text-ink-400 mt-3">
              {formatShowDateFull(show.date)} · AI interpretation, venue
              controls, and private internal notes stay here
            </div>
          </div>
          <div className="space-y-3">
            <FinancialSummary
              showId={show.id}
              proposedAmount={totalToArtist}
              defaultExpectedAmount={room.financialDelta?.reviewerRead}
            />
            <div className="rounded-xl bg-white/85 ring-1 ring-brand-200/70 px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-2">
              <Link href={`/shows/${show.id}/settle`}>
                <Button variant="secondary" size="sm" className="w-full justify-center">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Original settle page
                </Button>
              </Link>
              <Link href={`/shows/${show.id}/review`}>
                <Button variant="brand" size="sm" className="w-full justify-center">
                  <Eye className="h-3.5 w-3.5" />
                  Open shared view
                </Button>
              </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <VenueReviewRoom
        room={room}
        showId={show.id}
        totalToArtist={totalToArtist}
        defaultExpectedAmount={room.financialDelta?.reviewerRead}
      />
    </div>
  );
}
