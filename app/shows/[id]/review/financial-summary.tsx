"use client";

import { useMemo, useSyncExternalStore } from "react";
import { formatMoney } from "@/lib/format";

function expectedAmountStorageKey(showId: string) {
  return `greenroom:settlement-review-expected-amount:${showId}`;
}

function parseMoneyInput(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readExpectedAmountSnapshot(
  showId: string,
  defaultExpectedAmount?: number | null,
) {
  if (typeof window === "undefined") {
    return defaultExpectedAmount != null ? formatMoney(defaultExpectedAmount) : "";
  }
  return (
    window.localStorage.getItem(expectedAmountStorageKey(showId)) ??
    (defaultExpectedAmount != null ? formatMoney(defaultExpectedAmount) : "")
  );
}

function subscribeToExpectedAmount(showId: string, onStoreChange: () => void) {
  const storageKey = expectedAmountStorageKey(showId);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onStoreChange();
  };
  window.addEventListener(storageKey, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(storageKey, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeExpectedAmount(showId: string, value: string) {
  const storageKey = expectedAmountStorageKey(showId);
  window.localStorage.setItem(storageKey, value);
  window.dispatchEvent(new Event(storageKey));
}

function deltaToneClass(delta: number | null) {
  return delta === 0 ? "text-brand-800" : "text-rose-700";
}

function deltaLabelClass(delta: number | null) {
  return delta === 0 ? "text-brand-800" : "text-rose-700";
}

export function resetExpectedAmount(showId: string) {
  const storageKey = expectedAmountStorageKey(showId);
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(storageKey));
}

export function FinancialSummary({
  showId,
  proposedAmount,
  defaultExpectedAmount,
}: {
  showId: string;
  proposedAmount?: number | null;
  defaultExpectedAmount?: number | null;
}) {
  const expectedInput = useSyncExternalStore(
    (onStoreChange) => subscribeToExpectedAmount(showId, onStoreChange),
    () => readExpectedAmountSnapshot(showId, defaultExpectedAmount),
    () => (defaultExpectedAmount != null ? formatMoney(defaultExpectedAmount) : ""),
  );
  const expectedAmount = useMemo(
    () => parseMoneyInput(expectedInput),
    [expectedInput],
  );
  const delta =
    proposedAmount != null && expectedAmount != null
      ? Math.abs(expectedAmount - proposedAmount)
      : null;

  return (
    <div className="rounded-xl bg-white/85 ring-1 ring-brand-200/70 px-5 py-4 shadow-sm">
      <div>
        <div className="eyebrow text-[10px] text-brand-800 mb-2">
          Proposed To Artist
        </div>
        <div className="font-mono tabular text-[34px] font-semibold text-ink-900 leading-none">
          {formatMoney(proposedAmount)}
        </div>
      </div>

      <div className="mt-4 border-t border-ink-200/70 pt-4">
        <div>
          <div className="eyebrow text-[9px] text-brand-800 mb-1">
            Reviewer Expected Final
          </div>
          <div className="font-mono tabular text-[22px] font-semibold text-ink-900 leading-none">
            {formatMoney(expectedAmount)}
          </div>
        </div>

        <div className="mt-4">
          <div className={`eyebrow text-[9px] mb-1 ${deltaLabelClass(delta)}`}>
            Difference To Align
          </div>
          <div className={`font-mono tabular text-[24px] font-semibold leading-none ${deltaToneClass(delta)}`}>
            {delta == null ? "—" : formatMoney(delta)}
          </div>
          <div className="mt-2 text-[11.5px] text-ink-500 leading-relaxed">
            {expectedAmount != null && proposedAmount != null
              ? `Proposed ${formatMoney(proposedAmount)} · Expected ${formatMoney(expectedAmount)}`
              : "Enter reviewer expected final in the Review tab."}
          </div>
          <div className="mt-1 text-[11px] text-ink-400 leading-relaxed">
            Calculated from the expected payout supplied by the reviewer.
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExpectedPayoutReadout({
  showId,
  proposedAmount,
  defaultExpectedAmount,
}: {
  showId: string;
  proposedAmount?: number | null;
  defaultExpectedAmount?: number | null;
}) {
  const expectedInput = useSyncExternalStore(
    (onStoreChange) => subscribeToExpectedAmount(showId, onStoreChange),
    () => readExpectedAmountSnapshot(showId, defaultExpectedAmount),
    () => (defaultExpectedAmount != null ? formatMoney(defaultExpectedAmount) : ""),
  );
  const expectedAmount = useMemo(
    () => parseMoneyInput(expectedInput),
    [expectedInput],
  );
  const delta =
    proposedAmount != null && expectedAmount != null
      ? Math.abs(expectedAmount - proposedAmount)
      : null;

  return (
    <div className="space-y-3 border-t border-ink-200/70 pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="eyebrow text-[9px] text-brand-800">
          Reviewer Expected Final
        </div>
        <div className="font-mono tabular text-[18px] font-semibold text-ink-900 leading-none">
          {formatMoney(expectedAmount)}
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <div className={`eyebrow text-[9px] ${deltaLabelClass(delta)}`}>
          Difference To Align
        </div>
        <div className={`font-mono tabular text-[18px] font-semibold leading-none ${deltaToneClass(delta)}`}>
          {delta == null ? "—" : formatMoney(delta)}
        </div>
      </div>
    </div>
  );
}

export function DifferenceToAlignCard({
  showId,
  proposedAmount,
  defaultExpectedAmount,
}: {
  showId: string;
  proposedAmount?: number | null;
  defaultExpectedAmount?: number | null;
}) {
  const expectedInput = useSyncExternalStore(
    (onStoreChange) => subscribeToExpectedAmount(showId, onStoreChange),
    () => readExpectedAmountSnapshot(showId, defaultExpectedAmount),
    () => (defaultExpectedAmount != null ? formatMoney(defaultExpectedAmount) : ""),
  );
  const expectedAmount = useMemo(
    () => parseMoneyInput(expectedInput),
    [expectedInput],
  );
  const delta =
    proposedAmount != null && expectedAmount != null
      ? Math.abs(expectedAmount - proposedAmount)
      : null;

  return (
    <div className="rounded-lg bg-white ring-1 ring-ink-200/70 p-4">
      <div className={`eyebrow text-[9px] mb-1 ${deltaLabelClass(delta)}`}>
        Difference To Align
      </div>
      <div className={`font-mono tabular text-[24px] font-semibold leading-none ${deltaToneClass(delta)}`}>
        {delta == null ? "—" : formatMoney(delta)}
      </div>
      <div className="mt-2 text-[11.5px] text-ink-500 leading-relaxed">
        {delta != null && delta > 0
          ? "Driven by the reviewer expected final entered in the Review tab."
          : "No payout gap is currently flagged."}
      </div>
    </div>
  );
}

export function ExpectedPayoutInput({
  showId,
  proposedAmount,
  defaultExpectedAmount,
}: {
  showId: string;
  proposedAmount?: number | null;
  defaultExpectedAmount?: number | null;
}) {
  const expectedInput = useSyncExternalStore(
    (onStoreChange) => subscribeToExpectedAmount(showId, onStoreChange),
    () => readExpectedAmountSnapshot(showId, defaultExpectedAmount),
    () => (defaultExpectedAmount != null ? formatMoney(defaultExpectedAmount) : ""),
  );
  const expectedAmount = useMemo(
    () => parseMoneyInput(expectedInput),
    [expectedInput],
  );
  const delta =
    proposedAmount != null && expectedAmount != null
      ? Math.abs(expectedAmount - proposedAmount)
      : null;

  const formatAndSave = (value: string) => {
    const parsed = parseMoneyInput(value);
    writeExpectedAmount(showId, parsed == null ? value : formatMoney(parsed));
  };

  return (
    <div className="rounded-lg bg-brand-50/30 ring-1 ring-brand-200/60 p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-end">
        <div>
          <label htmlFor="reviewer-expected-amount" className="block">
            <span className="eyebrow text-[9px] text-brand-800 mb-1 block">
              Reviewer Expected Final
            </span>
            <input
              id="reviewer-expected-amount"
              value={expectedInput}
              onBlur={(event) => formatAndSave(event.target.value)}
              onChange={(event) =>
                writeExpectedAmount(showId, event.target.value)
              }
              placeholder="$12,285.00"
              className="h-9 w-full rounded-md border border-brand-200/80 bg-white px-2 font-mono tabular text-[14px] text-ink-900 placeholder:font-mono placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-300"
            />
          </label>
          <div className="mt-1 text-[11.5px] text-ink-500 leading-relaxed">
            Enter the final payout the reviewer expected. The hero calculates
            the alignment gap from this number.
          </div>
        </div>
        <div className="rounded-md bg-white/80 ring-1 ring-brand-200/60 px-3 py-2">
          <div className={`eyebrow text-[9px] mb-1 ${deltaLabelClass(delta)}`}>
            Current Difference
          </div>
          <div className={`font-mono tabular text-[20px] font-semibold leading-none ${deltaToneClass(delta)}`}>
            {delta == null ? "—" : formatMoney(delta)}
          </div>
          <div className="mt-1 text-[11px] text-ink-500">
            vs. {formatMoney(proposedAmount)} proposed
          </div>
        </div>
      </div>
    </div>
  );
}
