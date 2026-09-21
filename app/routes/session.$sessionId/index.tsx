import type { Route } from "./+types/index";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { players } from "~/db/schema/players";
import { sessionTotals } from "~/db/schema/session-totals";
import { rounds } from "~/db/schema/rounds";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Trophy, Shield, Share2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { getRoundMeta } from "~/lib/round.server";
import {
  useLoaderData,
  useFetcher,
  useParams,
  data,
  useRevalidator,
} from "react-router";
import { useGameConfig, usePlayers } from "~/stores/useSessionStore";
import { addToast } from "~/stores/useToastStore";
import { useEffect, useMemo } from "react";
import { Button } from "~/components/ui/button";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionId))
    .limit(1);

  if (!session) throw new Response("Session not found", { status: 404 });

  const playerTotals = await db
    .select({
      playerId: players.id,
      playerName: players.name,
      orderNo: players.orderNo,
      totalScore: sessionTotals.totalScore,
    })
    .from(players)
    .leftJoin(sessionTotals, eq(sessionTotals.playerId, players.id))
    .where(eq(players.sessionId, session.id))
    .orderBy(players.orderNo);
  const roundMeta = await getRoundMeta(session.id);

  const [firstRound] = await db
    .select({ createdAt: rounds.createdAt })
    .from(rounds)
    .where(eq(rounds.sessionId, session.id))
    .orderBy(rounds.createdAt)
    .limit(1);

  const [lastRound] = await db
    .select({ createdAt: rounds.createdAt })
    .from(rounds)
    .where(eq(rounds.sessionId, session.id))
    .orderBy(desc(rounds.createdAt))
    .limit(1);

  const roundTimeRange = {
    firstAt: firstRound?.createdAt ?? null,
    lastAt: lastRound?.createdAt ?? null,
  };

  return data(
    {
      session,
      playerTotals,
      roundMeta,
      roundTimeRange,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PlayerTotal = {
  playerId: string;
  playerName: string;
  orderNo: number;
  totalScore: number | null;
  initialScore: number;
};

function formatScore(score: number) {
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreTone(score: number) {
  if (score > 0) {
    return {
      text: "text-chart-2",
      bg: "bg-chart-2/15",
      border: "border-chart-2/20",
      ring: "ring-chart-2/15",
    };
  }

  if (score < 0) {
    return {
      text: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      ring: "ring-destructive/10",
    };
  }

  return {
    text: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border/70",
    ring: "ring-muted/10",
  };
}

function formatTimeRange(
  firstAt: string | null,
  lastAt: string | null,
): string {
  if (!firstAt || !lastAt) return "Chưa có ván đấu";

  const start = new Date(firstAt);
  const end = new Date(lastAt);

  const fmtTime = (d: Date) =>
    `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  const fmtDate = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;

  if (start.toDateString() === end.toDateString()) {
    return `từ ${fmtTime(start)} đến ${fmtTime(end)} ngày ${fmtDate(end)}`;
  }

  return `từ ${fmtTime(start)} ngày ${fmtDate(start)} đến ${fmtTime(end)} ngày ${fmtDate(end)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScorePill({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const tone = scoreTone(score);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border px-1 py-1 font-black tabular-nums shadow-sm",
        "min-w-12 text-base sm:min-w-20 sm:text-xl",
        tone.bg,
        tone.border,
        tone.text,
        tone.ring,
        "ring-1",
        className,
      )}
    >
      {formatScore(score)}
    </span>
  );
}

function ScoreRow({
  player,
  rank,
  multiplier,
}: {
  player: PlayerTotal;
  rank: number;
  multiplier: number;
}) {
  const score = player.totalScore ?? 0;
  const isLeader = rank === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-all",
        score > 0
          ? "border-primary/25 bg-primary/8 shadow-sm shadow-primary/10"
          : score === 0
            ? "border-border/70 bg-card/70"
            : "border-destructive/25 bg-destructive/8 shadow-sm shadow-destructive/10",
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-xl font-black",
          score > 0
            ? "bg-primary text-primary-foreground"
            : score === 0
              ? "text-muted-foreground bg-muted/40 border-border/70 ring-muted/10"
              : "bg-destructive/80 text-primary-foreground",
        )}
      >
        {rank + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-foreground text-base">
          {player.playerName}
        </p>
      </div>
      {player.initialScore > 0 && (
        <div className="relative inline-flex items-center justify-center">
          <Shield className="size-8 text-muted-foreground" />
          <span className="absolute text-[9px] font-bold text-muted-foreground leading-none">
            {player.initialScore}
          </span>
        </div>
      )}
      {/* Hệ số nhân điểm tổng (lưu trong game_configs, thiết lập khi tạo phòng, mặc định 3) */}
      <span className="text-gray-500">
        {score * multiplier}
      </span>
      <ScorePill score={score} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/30 p-8 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Trophy className="size-7" />
      </div>
      <p className="font-black text-foreground">Chưa có người chơi nào</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Bảng điểm sẽ xuất hiện ngay khi người chơi được thêm vào phòng.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SessionScoreboard({
  loaderData,
}: Route.ComponentProps) {
  const { sessionId: sessionCode } = useParams();
  const config = useGameConfig();
  const players = usePlayers();
  const revalidator = useRevalidator();

  // Không cần fetcher nữa — loaderData tự cập nhật sau khi revalidate
  const { playerTotals, roundMeta, roundTimeRange } = loaderData;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (revalidator.state !== "idle") return; // tránh gọi chồng
      revalidator.revalidate();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [revalidator]);

  const sorted = [...playerTotals]
    .map((pt) => {
      const player = players.find((p) => p.id === pt.playerId);
      return {
        ...pt,
        initialScore: player?.initialScore ?? 0,
        totalScore: (pt.totalScore ?? 0) + (player?.initialScore ?? 0),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  const leader = sorted[0] ?? null;
  const lowest = sorted[sorted.length - 1] ?? null;

  const accumulated = roundMeta.accumulated;

  const currentRoundNo = roundMeta.currentRoundNo;

  const gameConfig = useMemo(
    () => ({
      rankPoints: [
        config?.firstPlaceScore ?? 3,
        config?.secondPlaceScore ?? 1,
        config?.thirdPlaceScore ?? -1,
        config?.fourthPlaceScore ?? -3,
      ],
      khapPoints: config?.khapScore ?? 3,
      sanhPoints: config?.sanhScore ?? 5,
      maxKhapAccumulate: config?.khapLimit ?? 5,
      maxSanhAccumulate: config?.sanhLimit ?? 3,
      heoDoPoints: config?.redPigScore ?? 3,
      heodenPoints: config?.blackPigScore ?? 5,
      nhotBystanderPenalty:
        config?.nhotBystanderPenalty ?? Math.abs(config?.thirdPlaceScore ?? 2),
    }),
    [config],
  );

  const timeLabel = formatTimeRange(
    roundTimeRange?.firstAt ?? null,
    roundTimeRange?.lastAt ?? null,
  );

  const handleShare = async () => {
    addToast({ title: "Đang tạo ảnh...", duration: 2000 });
    try {
      const width = 360;
      const padding = 28;
      const titleHeight = 32;
      const timeHeight = 22;
      const rowGap = 10;
      const rowHeight = 64;
      const height =
        padding +
        titleHeight +
        timeHeight +
        10 +
        sorted.length * (rowHeight + rowGap) +
        padding;
      const fonts = [
        new FontFace("SFU Freeway", 'url("/fonts/SFUFreewayLight.TTF")', {
          weight: "300",
        }),
        new FontFace("SFU Freeway", 'url("/fonts/SFUFreewayRoman.TTF")', {
          weight: "400",
        }),
        new FontFace("SFU Freeway", 'url("/fonts/SFUFreewayDemi.TTF")', {
          weight: "600",
        }),
        new FontFace("SFU Freeway", 'url("/fonts/SFUFreewayBlack.TTF")', {
          weight: "900",
        }),
      ];

      await Promise.all(
        fonts.map(async (font) => {
          const loaded = await font.load();
          document.fonts.add(loaded);
        }),
      );

      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Không thể tạo canvas");

      ctx.scale(2, 2);

      const roundRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
      ) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      const bg = "#ffffff";
      const titleColor = "#0f172a";
      const muted = "#64748b";
      const label = `Thời gian ${timeLabel}`;

      roundRect(0, 0, width, height, 24);
      ctx.clip();
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = titleColor;
      ctx.font =
        '900 24px "SFU Freeway"';
        console.log(ctx.font);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`PHÒNG ${sessionCode}`, width / 2, padding + 14);

      ctx.fillStyle = muted;
      ctx.font =
        '400 14px "SFU Freeway"';
      ctx.fillText(label, width / 2, padding + 14 + 28);

      const tableTop = padding + titleHeight + timeHeight + 10;

      sorted.forEach((p, idx) => {
        const rowTop = tableTop + idx * (rowHeight + rowGap);
        const score = p.totalScore ?? 0;

        const rowBg =
          score > 0
            ? "oklab(0.508 -0.114299 0.0293215 / 0.08)"
            : score === 0
              ? "#f8fafc"
              : "oklab(0.577 0.217662 0.112464 / 0.08)";
        const rowBorder =
          score > 0
            ? "oklab(0.508 -0.114299 0.0293215 / 0.25)"
            : score === 0
              ? "#e2e8f0"
              : "oklab(0.577 0.217662 0.112464 / 0.25)";
        const scoreTextColor = score >= 0 ? "#16a34a" : "#dc2626";

        roundRect(padding, rowTop, width - padding * 2, rowHeight, 18);
        ctx.fillStyle = rowBg;
        ctx.fill();
        ctx.strokeStyle = rowBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        const badgeWidth = 30;
        const badgeHeight = 30;
        const badgeX = padding + 8;
        const badgeY = rowTop + rowHeight / 2 - badgeHeight / 2;
        const badgeRadius = 16;

        roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeRadius);

        ctx.fillStyle =
          score > 0 ? "#16a34a" : score === 0 ? "#e2e8f0" : "#dc2626";
        ctx.fill();

        ctx.fillStyle = score > 0 || score < 0 ? "#ffffff" : "#475569";
        ctx.font =
          '700 15px "SFU Freeway"';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `${idx + 1}`,
          badgeX + badgeWidth / 2,
          rowTop + rowHeight / 2,
        );

        ctx.fillStyle = "#0f172a";
        ctx.font =
          '700 16px "SFU Freeway"';
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const nameX = padding + 44;
        const nameText = p.playerName;
        ctx.fillText(nameText, nameX, rowTop + rowHeight / 2);

        if (p.initialScore > 0) {
          ctx.fillStyle = "#94a3b8";
          ctx.font =
            '500 12px "SFU Freeway"';
          ctx.fillText(
            `(+${p.initialScore})`,
            nameX + ctx.measureText(nameText).width + 8,
            rowTop + rowHeight / 2,
          );
        }

        // money
        const scoreTextMoney = `${(config?.scoreMultiplier ?? 3) * score}`;
        const textWidthMoney = ctx.measureText(scoreTextMoney).width;
        const pillWidthMoney = textWidthMoney;
        const pillXMoney = width - padding - pillWidthMoney - 62;
        const pillYMoney = rowTop + rowHeight / 2;
        ctx.font =
          '200 14px "SFU Freeway"';
        ctx.fillText(scoreTextMoney, pillXMoney, pillYMoney);
        ctx.strokeStyle = "oklch(0.551 0.027 264.364)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const scoreText = score > 0 ? `+${score}` : `${score}`;
        const textWidth = ctx.measureText(scoreText).width;
        const pillWidth = textWidth + 24;
        const pillHeight = 30;
        const pillX = width - padding - pillWidth - 8;
        const pillY = rowTop + rowHeight / 2 - pillHeight / 2;
        roundRect(pillX, pillY, pillWidth, pillHeight, 18);
        ctx.fillStyle = score >= 0 ? "#dcfce7" : "#fee2e2";
        ctx.fill();
        ctx.strokeStyle = score >= 0 ? "#bbf7d0" : "#fecaca";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = scoreTextColor;
        ctx.font =
          '800 15px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(scoreText, pillX + pillWidth / 2, rowTop + rowHeight / 2);
      });

      const blob = (await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      )) as Blob;
      const file = new File([blob], `bang-xep-hang-${sessionCode}.png`, {
        type: "image/png",
      });

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
        });
        addToast({ title: "Đã chia sẻ ảnh", icon: "success", duration: 3000 });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `bang-xep-hang-${sessionCode}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
      addToast({
        title: "Tạo ảnh thất bại",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-4 pb-32">
      {/* Ranking list */}
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Xếp hạng hiện tại</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              title="Chia sẻ bảng xếp hạng"
            >
              <Share2 className="size-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 pt-0">
          {sorted.length === 0 ? (
            <EmptyState />
          ) : (
            sorted.map((player, index) => (
              <ScoreRow
                key={player.playerId}
                player={player}
                rank={index}
                multiplier={config?.scoreMultiplier ?? 3}
              />
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
