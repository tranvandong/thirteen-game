"use client";

import { Flame, Spade, Minus, Plus } from "lucide-react";

interface BonusControlsProps {
  khapWinner: string | null;
  khapCount: number;
  sanhWinner: string | null;
  accumulatedSanh: number;
  updateKhapCount: (delta: number) => void;
  maxKhapAccumulate: number;
}

export function BonusControls({
  khapWinner,
  khapCount,
  sanhWinner,
  accumulatedSanh,
  updateKhapCount,
  maxKhapAccumulate,
}: BonusControlsProps) {
  const hasWinner = khapWinner || sanhWinner;

  if (!hasWinner) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-4">
      {/* Khạp control */}
      {khapWinner && khapCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2">
          <Flame className="size-5 text-rose-500" />
          <span className="text-sm font-bold text-rose-600">Khạp ×{khapCount}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateKhapCount(-1)}
              disabled={khapCount <= 1}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold disabled:opacity-30"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-6 text-center text-sm font-bold">{khapCount}</span>
            <button
              onClick={() => updateKhapCount(1)}
              disabled={khapCount >= maxKhapAccumulate}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold disabled:opacity-30"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Sảnh indicator */}
      {sanhWinner && (
        <div className="flex items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2">
          <Spade className="size-5 text-indigo-500" />
          <span className="text-sm font-bold text-indigo-600">Sảnh ×{accumulatedSanh}</span>
        </div>
      )}
    </div>
  );
}