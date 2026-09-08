import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Scissors, Lock, Plus, X } from "lucide-react";

const BUBBLE_SIZE = 56;
const BUTTON_SIZE = 48;
const BUTTON_GAP = 10;
const DRAG_THRESHOLD = 4;
const STORAGE_KEY = "draggable-action-bubble-position";
const TOP_OFFSET = 80;
const BOTTOM_OFFSET = 90;
const X_OFFSET = 10;

type Placement = "below" | "above";

interface Position {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultPosition(): Position {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }
  return {
    x: window.innerWidth - BUBBLE_SIZE - X_OFFSET,
    y: clamp(window.innerHeight - BUBBLE_SIZE - 120, TOP_OFFSET, window.innerHeight - BOTTOM_OFFSET - BUBBLE_SIZE),
  };
}

function loadPosition(): Position {
  if (typeof window === "undefined") return getDefaultPosition();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPosition();
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return {
        x: clamp(parsed.x, X_OFFSET, window.innerWidth - BUBBLE_SIZE - X_OFFSET),
        y: clamp(parsed.y, TOP_OFFSET, window.innerHeight - BOTTOM_OFFSET - BUBBLE_SIZE),
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return getDefaultPosition();
}

function getPlacement(y: number): Placement {
  if (typeof window === "undefined") return "below";
  const midPoint = window.innerHeight / 2;
  return y > midPoint ? "above" : "below";
}

export interface DraggableActionBubbleProps {
  onOpenNhotBai: () => void;
  onOpenChatHeo: () => void;
}

export function DraggableActionBubble({
  onOpenNhotBai,
  onOpenChatHeo,
}: DraggableActionBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>(loadPosition);
  const dragState = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  } | null>(null);
  const latestPositionRef = useRef<Position>(loadPosition());

  const placement = getPlacement(position.y);
  const isBelow = placement === "below";

  useEffect(() => {
    latestPositionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setPosition((prev) => ({
        x: clamp(prev.x, X_OFFSET, window.innerWidth - BUBBLE_SIZE - X_OFFSET),
        y: clamp(prev.y, TOP_OFFSET, window.innerHeight - BOTTOM_OFFSET - BUBBLE_SIZE),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragState.current = {
      startX: clientX,
      startY: clientY,
      initialX: latestPositionRef.current.x,
      initialY: latestPositionRef.current.y,
      hasMoved: false,
    };
  }, []);

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragState.current) return;

      const deltaX = clientX - dragState.current.startX;
      const deltaY = clientY - dragState.current.startY;

      if (
        Math.abs(deltaX) > DRAG_THRESHOLD ||
        Math.abs(deltaY) > DRAG_THRESHOLD
      ) {
        dragState.current.hasMoved = true;
      }

      const newX = clamp(
        dragState.current.initialX + deltaX,
        X_OFFSET,
        window.innerWidth - BUBBLE_SIZE - X_OFFSET,
      );
      const newY = clamp(
        dragState.current.initialY + deltaY,
        TOP_OFFSET,
        window.innerHeight - BOTTOM_OFFSET - BUBBLE_SIZE,
      );

      latestPositionRef.current = { x: newX, y: newY };
      setPosition({ x: newX, y: newY });
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    if (dragState.current?.hasMoved) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(latestPositionRef.current),
        );
      } catch {
        // ignore storage errors
      }
    }
    dragState.current = null;
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onMouseUp = () => handleDragEnd();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => handleDragEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  const handleBubbleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleBubbleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleBubbleClick = () => {
    if (dragState.current?.hasMoved) {
      dragState.current.hasMoved = false;
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const bubbleCenter = BUBBLE_SIZE / 2;
  const actionButtonTop = isBelow
    ? BUBBLE_SIZE + BUTTON_GAP
    : -(BUTTON_SIZE * 2 + BUTTON_GAP * 2);

  return (
    <div
      className="fixed z-50"
      style={{
        left: position.x,
        top: position.y,
        touchAction: "none",
      }}
    >
      <div
        className="absolute flex flex-col items-center gap-3 transition-all duration-300 ease-out"
        style={{
          top: actionButtonTop,
          left: bubbleCenter - BUTTON_SIZE / 2,
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full border-border/70 bg-card/95 shadow-lg backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
            onClick={() => handleAction(onOpenChatHeo)}
          >
            <Scissors className="size-5 text-destructive" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full border-border/70 bg-card/95 shadow-lg backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
            onClick={() => handleAction(onOpenNhotBai)}
          >
            <Lock className="size-5 text-chart-1" />
          </Button>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onMouseDown={handleBubbleMouseDown}
        onMouseUp={handleDragEnd}
        onClick={handleBubbleClick}
        onTouchStart={handleBubbleTouchStart}
        onTouchEnd={handleDragEnd}
        className={`flex size-14 cursor-grab active:cursor-grabbing items-center justify-center rounded-full border border-border/80 bg-primary/95 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95 ${
          isOpen ? "opacity-100" : "opacity-75"
        }`}
      >
        {isOpen ? (
          <X className="size-6 text-primary-foreground" />
        ) : (
          <Plus className="size-6 text-primary-foreground" />
        )}
      </div>
    </div>
  );
}
