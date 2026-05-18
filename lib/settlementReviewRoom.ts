import type {
  Comp,
  Deal,
  Expense,
  Recoup,
  Settlement,
  Show,
  TicketSale,
} from "@/db/schema";
import type { SettlementCalculation } from "@/lib/dealMath";

export type ReviewConfidence = "high" | "medium" | "low";
export type ReviewSeverity = "info" | "watch" | "needs_alignment";
export type ReviewAction = "acknowledged" | "questioned" | "contested";
export type StoredReviewAction = ReviewAction | "unreviewed";
export type StoredReviewItem = {
  action: StoredReviewAction;
  note?: string;
  noteAuthor?: string;
  noteDraft?: string;
  venueResponse?: string;
  venueResponseDraft?: string;
  reviewerFollowUps?: string[];
  reviewerFollowUpAuthors?: string[];
  reviewerFollowUp?: string;
  reviewerFollowUpDraft?: string;
  resolutionAccepted?: boolean;
  reviewerPositionAccepted?: boolean;
};
export type StoredReviewState = Record<string, StoredReviewItem>;

export type ReviewInterpretation = {
  id: string;
  topic: string;
  originalText: string;
  proposedMeaning: string;
  confidence: ReviewConfidence;
  reasoning: string;
};

export type ReviewFlag = {
  id: string;
  severity: ReviewSeverity;
  title: string;
  evidence: string;
  whyItMatters: string;
  suggestedResolution: string;
};

export type ReviewRewrite = {
  id: string;
  title: string;
  originalText: string;
  aiGeneratedSummary: string;
  suggestedText: string;
};

export type MathAnnotation = {
  id: string;
  label: string;
  value: number | null;
  source: string;
  rationale: string;
  reviewAction?: ReviewAction;
};

export type ReviewerActivity = {
  itemId: string;
  actor: string;
  action: ReviewAction;
  note: string;
};

export type SettlementReviewRoom = {
  summary: string;
  readiness: "ready" | "review_needed" | "contested";
  reviewerStatus: string;
  shareLabel: string;
  financialDelta?: {
    label: string;
    amount: number;
    venueRead: number;
    reviewerRead: number;
    note: string;
  };
  interpretations: ReviewInterpretation[];
  flags: ReviewFlag[];
  rewrites: ReviewRewrite[];
  mathAnnotations: MathAnnotation[];
  reviewerActivity: ReviewerActivity[];
};

type BuildReviewInput = {
  show: Show;
  deal: Deal;
  settlement: Settlement | null;
  calc: SettlementCalculation;
  ticketSales: TicketSale[];
  expenses: Expense[];
  comps: Comp[];
  recoups: Recoup[];
};

export function reviewActionStorageKey(showId: string): string {
  return `greenroom:settlement-review-actions:${showId}`;
}

const DEAL_LABELS: Record<Deal["dealType"], string> = {
  flat: "flat guarantee",
  percentage_of_gross: "percentage of gross",
  percentage_of_net: "percentage of net",
  vs: "guarantee versus percentage",
  door: "door deal",
};

export function buildSettlementReviewRoom({
  show,
  deal,
  settlement,
  calc,
  ticketSales,
  expenses,
  comps,
  recoups,
}: BuildReviewInput): SettlementReviewRoom {
  const gross = ticketSales.reduce((sum, row) => sum + row.gross, 0);
  const fees = ticketSales.reduce((sum, row) => sum + row.fees, 0);
  const passedThroughExpenses = expenses
    .filter((expense) => !expense.absorbedByVenue)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const absorbedExpenses = expenses
    .filter((expense) => expense.absorbedByVenue)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const disputedRecoups = recoups.filter((recoup) => recoup.status === "disputed");
  const notes = deal.dealNotesFreetext ?? "No free-text deal notes were entered.";
  const hasCoastalSpellRisk = show.id === "show_coastal_spell_dispute";
  const hasRecoupCapAmbiguity =
    deal.expenseCap != null &&
    recoups.some((recoup) => recoup.category === "marketing") &&
    /recoup|against gross|expense/i.test(notes);
  const hasUnsupportedDeal = !calc.supported;

  const interpretations: ReviewInterpretation[] = [
    {
      id: "deal-shape",
      topic: "Deal shape",
      originalText: notes,
      proposedMeaning: describeDealShape(deal),
      confidence:
        deal.dealType === "flat" || deal.dealType === "percentage_of_gross"
          ? "high"
          : "medium",
      reasoning:
        "This is inferred from the structured deal fields and Mariana's free-text notes so both sides can review the same interpretation.",
    },
    {
      id: "expense-treatment",
      topic: "Expense treatment",
      originalText:
        deal.expenseCap != null
          ? `Expenses capped at ${deal.expenseCap}.`
          : "No explicit expense cap is stored.",
      proposedMeaning:
        deal.expenseCap != null
          ? `Passed-through show expenses should be capped at ${money(deal.expenseCap)} before calculating artist share. Venue-absorbed costs should be shown but not deducted.`
          : "No expense cap is applied by the structured deal fields; any deductions need explicit review against the deal notes.",
      confidence: deal.expenseCap != null ? "medium" : "high",
      reasoning:
        "Expense caps are one of the most common places where the venue and artist side need the same language in front of them.",
    },
  ];

  if (recoups.length > 0) {
    interpretations.push({
      id: "recoup-treatment",
      topic: "Recoup treatment",
      originalText: notes,
      proposedMeaning: hasRecoupCapAmbiguity
        ? "Marketing recoup is being treated as a separate line item for review, but the deal language does not clearly say whether it sits inside or outside the expense cap."
        : "Recoups are shown as separate reviewable line items so the artist side can acknowledge or contest them before signoff.",
      confidence: hasRecoupCapAmbiguity ? "low" : "medium",
      reasoning:
        "The artifact separates the interpretation from the raw wording so the disagreement can happen around the clause, not after a PDF is sent.",
    });
  }

  const flags: ReviewFlag[] = [];
  if (hasRecoupCapAmbiguity) {
    flags.push({
      id: "marketing-recoup-cap",
      severity: "needs_alignment",
      title: "Marketing recoup needs shared interpretation",
      evidence: extractEvidence(notes, "Marketing recoup"),
      whyItMatters:
        hasCoastalSpellRisk
          ? "The venue read the $900 recoup as outside the cap, landing at $11,565. WME read it as inside the $2,500 cap, landing at $12,285. The difference is $720."
          : "If the recoup is outside the expense cap, the venue payout math lands lower than if it is included inside the cap.",
      suggestedResolution:
        "Have both sides confirm whether marketing recoup is included in the expense cap or deducted separately before signoff.",
    });
  }

  if (hasUnsupportedDeal) {
    flags.push({
      id: "unsupported-engine",
      severity: "watch",
      title: "Current calculator cannot fully settle this deal type",
      evidence: DEAL_LABELS[deal.dealType],
      whyItMatters:
        "Mariana would normally move to a spreadsheet here, which is where the settlement stops being a shared Greenroom artifact.",
      suggestedResolution:
        "Use the Review Room to align on interpretation and show the off-platform settlement result until the engine supports this deal end-to-end.",
    });
  }

  if (absorbedExpenses > 0) {
    flags.push({
      id: "absorbed-expenses",
      severity: "info",
      title: "Venue-absorbed costs are separated from artist deductions",
      evidence: `${money(absorbedExpenses)} marked absorbed by venue.`,
      whyItMatters:
        "Sarah and Diego both called out absorbed-vs-passed-through clarity as a trust builder.",
      suggestedResolution:
        "Keep absorbed costs visible but outside the artist deduction math.",
    });
  }

  const compsTowardGross = comps.filter((comp) => comp.countsTowardGross);
  if (compsTowardGross.length > 0) {
    flags.push({
      id: "comps-toward-gross",
      severity: "watch",
      title: "Some comps count toward gross",
      evidence: `${compsTowardGross.reduce((sum, comp) => sum + comp.count, 0)} comp tickets marked as counting toward gross.`,
      whyItMatters:
        "Comp treatment can change the basis used for percentage deals, so reviewers need to see the assumption.",
      suggestedResolution:
        "Confirm comp treatment before the reviewer marks the settlement ready.",
    });
  }

  if (flags.length === 0) {
    flags.push({
      id: "clean-artifact",
      severity: "info",
      title: "No major clarity issues detected",
      evidence: "Structured fields and deal notes do not expose a high-risk mismatch.",
      whyItMatters:
        "Clean deals still get the same shared artifact so every settlement has a readable paper trail.",
      suggestedResolution:
        "Reviewer can acknowledge the statement and mark it ready for signoff.",
    });
  }

  const rewrites: ReviewRewrite[] = [
    {
      id: "shared-deal-language",
      title: hasRecoupCapAmbiguity
        ? "Clarify marketing recoup placement"
        : "Plain-English shared deal terms",
      originalText: notes,
      aiGeneratedSummary: buildAiGeneratedSharedSummary({
        deal,
        recoups,
        hasRecoupCapAmbiguity,
      }),
      suggestedText: hasRecoupCapAmbiguity
        ? "Marketing recoup of $900 is [included in / separate from] the $2,500 expense cap. If included, artist payout is $12,285. If separate, artist payout is $11,565. Both venue and artist side must select one interpretation before final signoff."
        : describeDealShape(deal),
    },
  ];

  const mathAnnotations = buildMathAnnotations({
    calc,
    settlement,
    gross,
    fees,
    passedThroughExpenses,
    recoups,
    hasCoastalSpellRisk,
  });

  const reviewerActivity = buildReviewerActivity({
    flags,
    hasCoastalSpellRisk,
    settlement,
  });

  const readiness =
    reviewerActivity.some((activity) => activity.action === "contested") ||
    disputedRecoups.length > 0
      ? "contested"
      : flags.some((flag) => flag.severity === "needs_alignment")
        ? "review_needed"
        : "ready";

  return {
    summary: buildSummary({ deal, hasRecoupCapAmbiguity, hasUnsupportedDeal }),
    readiness,
    reviewerStatus:
      readiness === "contested"
        ? "Reviewer has contested at least one item"
        : readiness === "review_needed"
          ? "Needs reviewer alignment before signoff"
          : "Ready for reviewer acknowledgment",
    shareLabel: `greenroom.review/${show.id}`,
    financialDelta: hasCoastalSpellRisk
      ? {
          label: "Difference To Align",
          amount: 720,
          venueRead: 11565,
          reviewerRead: 12285,
          note: "Depends on whether the $900 marketing recoup sits inside or outside the expense cap.",
        }
      : undefined,
    interpretations,
    flags,
    rewrites,
    mathAnnotations,
    reviewerActivity,
  };
}

function describeDealShape(deal: Deal): string {
  if (deal.dealType === "flat") {
    return `Artist receives a flat guarantee of ${money(deal.guaranteeAmount)}${deal.bonusesJson ? " plus any structured bonuses that trigger." : "."}`;
  }
  if (deal.dealType === "percentage_of_gross") {
    return `Artist receives ${(deal.percentage ?? 0) * 100}% of gross box office, before expense deductions.`;
  }
  if (deal.dealType === "percentage_of_net") {
    return `Artist receives ${(deal.percentage ?? 0) * 100}% of net box office after approved deductions.`;
  }
  if (deal.dealType === "vs") {
    return `Artist receives the greater of ${money(deal.guaranteeAmount)} guarantee or ${(deal.percentage ?? 0) * 100}% of ${deal.percentageBasis ?? "net"} after agreed deductions.`;
  }
  return "Door deal requires reviewer alignment on attendance, ticket basis, and allowed deductions.";
}

function buildAiGeneratedSharedSummary({
  deal,
  recoups,
  hasRecoupCapAmbiguity,
}: {
  deal: Deal;
  recoups: Recoup[];
  hasRecoupCapAmbiguity: boolean;
}) {
  const parts = [describeDealShape(deal)];

  if (deal.expenseCap != null) {
    parts.push(`Expenses are capped at ${money(deal.expenseCap)}.`);
  }

  if (deal.hospitalityCap != null) {
    parts.push(`Hospitality is capped at ${money(deal.hospitalityCap)}.`);
  }

  for (const recoup of recoups) {
    parts.push(`${recoup.label} is listed as a ${money(recoup.amount)} recoup.`);
  }

  if (hasRecoupCapAmbiguity) {
    parts.push(
      "Greenroom flags the marketing recoup because the email language does not state whether it is included inside the expense cap or deducted separately.",
    );
  }

  return parts.join(" ");
}

function buildSummary({
  deal,
  hasRecoupCapAmbiguity,
  hasUnsupportedDeal,
}: {
  deal: Deal;
  hasRecoupCapAmbiguity: boolean;
  hasUnsupportedDeal: boolean;
}) {
  if (hasRecoupCapAmbiguity) {
    return "AI reads this as a vs deal with one unresolved interpretation: whether the $900 marketing recoup sits inside or outside the $2,500 expense cap. That choice moves the artist payout by $720, so the Review Room makes it explicit before signoff.";
  }
  if (hasUnsupportedDeal) {
    return `AI structured the ${DEAL_LABELS[deal.dealType]} into a shared review artifact even though the current calculator cannot complete this deal end-to-end.`;
  }
  return "AI found a clean interpretation and turned it into a shared settlement artifact the artist side can review before signoff.";
}

function buildMathAnnotations({
  calc,
  settlement,
  gross,
  fees,
  passedThroughExpenses,
  recoups,
  hasCoastalSpellRisk,
}: {
  calc: SettlementCalculation;
  settlement: Settlement | null;
  gross: number;
  fees: number;
  passedThroughExpenses: number;
  recoups: Recoup[];
  hasCoastalSpellRisk: boolean;
}): MathAnnotation[] {
  const rows: MathAnnotation[] = [
    {
      id: "gross",
      label: "Gross box office",
      value: gross,
      source: "Ticket sales",
      rationale: "Starting point for settlement review.",
      reviewAction: "acknowledged",
    },
    {
      id: "fees",
      label: "Less fees",
      value: -fees,
      source: "Integrated ticketing fees",
      rationale: "Fees are deducted before net is calculated.",
      reviewAction: "acknowledged",
    },
    {
      id: "expenses",
      label: "Passed-through expenses",
      value: -passedThroughExpenses,
      source: "Approved expense lines",
      rationale: "Only costs not absorbed by the venue are included in the review math.",
      reviewAction: "acknowledged",
    },
  ];

  for (const recoup of recoups) {
    rows.push({
      id: recoup.id,
      label: recoup.label,
      value: -recoup.amount,
      source: "Recoup line item",
      rationale:
        recoup.status === "disputed"
          ? "Reviewer needs to align on whether this recoup is allowed under the deal language."
          : "Separate line so the artist side can see what is being deducted.",
      reviewAction: recoup.status === "disputed" ? "contested" : "acknowledged",
    });
  }

  if (calc.supported) {
    for (const [index, step] of calc.steps.entries()) {
      rows.push({
        id: `calc-${index}`,
        label: step.label,
        value: step.value,
        source: "Greenroom settlement engine",
        rationale: step.note ?? calc.finalFormula,
        reviewAction: "acknowledged",
      });
    }
    rows.push({
      id: "total",
      label: "Total to artist",
      value: calc.totalToArtist,
      source: "Calculated in Greenroom",
      rationale: calc.finalFormula,
      reviewAction: "acknowledged",
    });
  } else {
    rows.push({
      id: "off-platform-total",
      label: "Proposed total to artist",
      value: settlement?.totalToArtist ?? null,
      source: hasCoastalSpellRisk
        ? "Venue proposed settlement"
        : "Logged settlement result",
      rationale: hasCoastalSpellRisk
        ? "Shows the venue proposal before reviewer expected payout is aligned."
        : "Used as the shared number while unsupported deal math is reviewed.",
      reviewAction: hasCoastalSpellRisk ? "contested" : "acknowledged",
    });
  }

  return rows;
}

function buildReviewerActivity({
  flags,
  hasCoastalSpellRisk,
  settlement,
}: {
  flags: ReviewFlag[];
  hasCoastalSpellRisk: boolean;
  settlement: Settlement | null;
}): ReviewerActivity[] {
  if (hasCoastalSpellRisk) {
    return [
      {
        itemId: "marketing-recoup-cap",
        actor: "Daniel Hwang, WME",
        action: "contested",
        note: "Please confirm whether the $900 marketing recoup is inside the $2,500 expense cap.",
      },
      {
        itemId: "shared-deal-language",
        actor: "Mariana Reyes",
        action: "questioned",
        note: "Venue read this as against gross; proposed language makes both interpretations explicit.",
      },
    ];
  }

  if (settlement?.status === "signed" || settlement?.status === "paid") {
    return [
      {
        itemId: "total",
        actor: "Tour manager",
        action: "acknowledged",
        note: "Reviewed statement and marked ready for signoff.",
      },
    ];
  }

  return [
    {
      itemId: flags[0]?.id ?? "clean-artifact",
      actor: "Tour manager",
      action: "questioned",
      note: "Waiting on reviewer confirmation.",
    },
  ];
}

function extractEvidence(text: string, fallback: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const match = sentences.find((sentence) =>
    sentence.toLowerCase().includes(fallback.toLowerCase().split(" ")[0]),
  );
  return match ?? fallback;
}

function money(amount: number | null | undefined): string {
  if (amount == null) return "unspecified";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
