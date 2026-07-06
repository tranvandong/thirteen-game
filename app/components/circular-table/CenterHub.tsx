"use client";

import { Button } from "~/components/ui/button";

interface CenterHubProps {
  activeNhot: { dennerId?: string; denForIds?: string[] } | null;
  nhotCount: number;
  selectCounter: number;
  requiredSelections: number;
  totalPlayers: number;
  save: () => void;
  disabledSaveButton: boolean;
}

export function CenterHub({
  activeNhot,
  nhotCount,
  selectCounter,
  requiredSelections,
  totalPlayers,
  save,
  disabledSaveButton,
}: CenterHubProps) {
  const displayCounter = activeNhot ? selectCounter : selectCounter;
  const displayTotal = activeNhot ? requiredSelections : totalPlayers;
  const isNhotMode = activeNhot !== null;

  return (
    <div className="relative z-10 flex items-center justify-center pb-3">
      <Button
        onClick={save}
        disabled={disabledSaveButton}
        className={`
          flex flex-col items-center justify-center gap-0.5 rounded-full shadow-xl 
          transition-all duration-300
          ${disabledSaveButton
            ? "bg-muted text-muted-foreground border-2 border-border"
            : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95"
          }
        `}
        style={{ width: 100, height: 100 }}
      >
        {isNhotMode ? (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wide">
              Xác nhận
            </span>
            <span className="text-[9px] uppercase tracking-wide opacity-70">
              Nhốt {nhotCount}
            </span>
            <span className="text-xl font-black tabular-nums">
              {displayCounter}/{displayTotal}
            </span>
          </>
        ) : (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wide">
              Xác nhận
            </span>
            <span className="text-[9px] uppercase tracking-wide opacity-70">
              {totalPlayers} người
            </span>
            <span className="text-xl font-black tabular-nums">
              {displayCounter}/{displayTotal}
            </span>
          </>
        )}
      </Button>
    </div>
  );
}