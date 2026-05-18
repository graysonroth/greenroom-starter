"use client";

import type React from "react";
import { useState } from "react";

type SharedReviewSection = "terms" | "focus" | "math" | "review" | "resolution";

export function SharedReviewTabs({
  dealTerms,
  reviewFocus,
  math,
  review,
  resolution,
}: {
  dealTerms: React.ReactNode;
  reviewFocus: React.ReactNode;
  math: React.ReactNode;
  review: React.ReactNode;
  resolution: React.ReactNode;
}) {
  const [activeSection, setActiveSection] =
    useState<SharedReviewSection>("terms");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-lg bg-canvas-soft ring-1 ring-ink-200/60 p-2">
        <SectionTab
          active={activeSection === "terms"}
          onClick={() => setActiveSection("terms")}
        >
          Deal Terms
        </SectionTab>
        <SectionTab
          active={activeSection === "focus"}
          onClick={() => setActiveSection("focus")}
        >
          Review Focus
        </SectionTab>
        <SectionTab
          active={activeSection === "math"}
          onClick={() => setActiveSection("math")}
        >
          Math
        </SectionTab>
        <SectionTab
          active={activeSection === "review"}
          onClick={() => setActiveSection("review")}
        >
          Review
        </SectionTab>
        <SectionTab
          active={activeSection === "resolution"}
          onClick={() => setActiveSection("resolution")}
        >
          Resolution
        </SectionTab>
      </div>

      {activeSection === "terms" && dealTerms}
      {activeSection === "focus" && reviewFocus}
      {activeSection === "math" && math}
      {activeSection === "review" && review}
      {activeSection === "resolution" && resolution}
    </div>
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
