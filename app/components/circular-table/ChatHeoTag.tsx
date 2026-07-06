"use client";

import { Scissors } from "lucide-react";
import type { ChatHeo, GameConfigSlice } from "./types";
import { calculateChatHeoPoints } from "./utils";

interface ChatHeoTagProps {
  chat: ChatHeo;
  gameConfig: GameConfigSlice;
  isChatter: boolean;
}

export function ChatHeoTag({ chat, gameConfig, isChatter }: ChatHeoTagProps) {
  const pts = calculateChatHeoPoints(chat.heo, gameConfig);
  const colorClass = isChatter ? "emerald" : "red";
  const borderColorClass = isChatter
    ? "border-emerald-500/30 bg-emerald-500/15"
    : "border-red-500/30 bg-red-500/15";
  const textColorClass = isChatter ? "text-emerald-600" : "text-red-600";

  return (
    <div
      className={`
        flex items-center gap-1 rounded-lg border px-2 py-1
        ${borderColorClass}
      `}
    >
      <Scissors className={`size-3 ${textColorClass}`} />
      {(chat.heo.do ?? 0) > 0 && (
        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
          {chat.heo.do}đ
        </span>
      )}
      {(chat.heo.den ?? 0) > 0 && (
        <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-black text-background">
          {chat.heo.den}đ
        </span>
      )}
      <span className={`text-[10px] font-bold ${textColorClass}`}>
        {isChatter ? "+" : "-"}
        {pts}
      </span>
    </div>
  );
}