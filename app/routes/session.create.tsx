"use client";

import { useState } from "react";
import type { Route } from "./+types/session.create";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { gameConfigs } from "~/db/schema/game-configs";
import { players as playersSchema } from "~/db/schema/players";
import { participants } from "~/db/schema/participants";
import { redirect } from "react-router";
import { eq } from "drizzle-orm";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  ChevronDown,
  ChevronLeft,
  Users,
  Trophy,
  Settings,
  Play,
  Spade,
  Flame,
  Sparkles,
  PiggyBank,
  Swords,
  Crown,
  Zap,
  Target,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────

/** Tạo mã phòng ngẫu nhiên dạng XXXX-XXXX */
function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 4 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  return `${part()}-${part()}`;
}

/** Parse số nguyên từ FormData, fallback về giá trị mặc định nếu không hợp lệ */
function parseIntField(data: FormData, key: string, fallback: number): number {
  const val = parseInt(data.get(key) as string);
  return isNaN(val) ? fallback : val;
}

// ── Server Action ─────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const data = await request.formData();

  // ── 1. Đọc dữ liệu từ form ──────────────────────────────
  const ownerName = (data.get("ownerName") as string)?.trim();
  const playerNames = [1, 2, 3, 4].map((i) =>
    (data.get(`player${i}`) as string)?.trim(),
  );

  // Validate cơ bản ở server
  if (!ownerName || playerNames.some((n) => !n)) {
    return { error: "Vui long dien day du thong tin" };
  }

  const gameConfigValues = {
    firstPlaceScore: parseIntField(data, "firstPlaceScore", 3),
    secondPlaceScore: parseIntField(data, "secondPlaceScore", 2),
    thirdPlaceScore: parseIntField(data, "thirdPlaceScore", -2),
    fourthPlaceScore: parseIntField(data, "fourthPlaceScore", -3),
    redPigScore: parseIntField(data, "redPigScore", 3),
    blackPigScore: parseIntField(data, "blackPigScore", 2),
    tripleScore: parseIntField(data, "tripleScore", 20),
    khapScore: parseIntField(data, "khapScore", 1),
    khapLimit: parseIntField(data, "khapLimit", 10),
    sanhScore: parseIntField(data, "sanhScore", 1),
    sanhLimit: parseIntField(data, "sanhLimit", 10),
  };

  // ── 2. Tạo tất cả trong một transaction ─────────────────
  try {
    const result = await db.transaction(async (tx) => {
      // 2a. Tạo session với mã phòng duy nhất
      let sessionCode = generateSessionCode();
      // Đảm bảo code chưa tồn tại (cực kỳ hiếm xảy ra)
      const existing = await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.code, sessionCode))
        .limit(1);
      if (existing.length > 0) {
        sessionCode = generateSessionCode();
      }

      const [session] = await tx
        .insert(sessions)
        .values({
          code: sessionCode,
          status: "active",
        })
        .returning();

      // 2b. Tạo participant cho chủ phòng (role = "owner")
      const [owner] = await tx
        .insert(participants)
        .values({
          sessionId: session.id,
          displayName: ownerName,
          role: "owner",
        })
        .returning();

      // 2c. Cập nhật ownerParticipantId vào session
      await tx
        .update(sessions)
        .set({ ownerParticipantId: owner.id })
        .where(eq(sessions.id, session.id));

      // 2d. Lưu game config
      await tx.insert(gameConfigs).values({
        sessionId: session.id,
        ...gameConfigValues,
      });

      // 2e. Tạo 4 players theo thứ tự
      await tx.insert(playersSchema).values(
        playerNames.map((name, idx) => ({
          sessionId: session.id,
          name,
          orderNo: idx + 1,
        })),
      );

      return {
        sessionCode: session.code,
        sessionId: session.id,
        ownerId: owner.id,
      };
    });

    // 3. Redirect sang trang chờ của session
    // Truyền ownerId qua cookie/session storage tuỳ auth strategy của bạn
    throw redirect(`/session/${result.sessionCode}`);
  } catch (err) {
    // re-throw redirects
    if (err instanceof Response) throw err;

    console.error("[CreateSession] Transaction failed:", err);
    return { error: "Khong the tao phong. Vui long thu lai." };
  }
}

// ── Meta ──────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tao phong choi - Thirteen Game" }];
}

// ── Score preview helper ──────────────────────────────────────

const RANK_LABELS = ["Nhất", "Nhì", "Ba", "Tư"];
const RANK_COLORS = [
  "from-yellow-300 to-amber-500 text-amber-950",
  "from-emerald-300 to-emerald-500 text-emerald-950",
  "from-slate-200 to-slate-400 text-slate-950",
  "from-rose-300 to-red-500 text-white",
];

// ── Number stepper component ──────────────────────────────────

function ScoreInput({
  id,
  label,
  name,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
          {label}
        </Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex items-center rounded-2xl border border-input bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80"
        >
          −
        </button>
        <Input
          id={id}
          type="number"
          name={name}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="h-8 rounded-none border-0 bg-transparent px-2 text-center font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80"
        >
          +
        </button>
      </div>
    </div>
  );
}

function PlayerRow({
  index,
  value,
  error,
  onChange,
}: {
  index: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={`group relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
        error
          ? "border-destructive/40 bg-destructive/5"
          : "border-border/70 bg-background/70 hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black shadow-sm ${RANK_COLORS[index]}`}
      >
        {index + 1}
      </div>

      <Input
        id={`player${index + 1}`}
        name={`player${index + 1}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Tên người chơi ${index + 1}`}
        className={`min-w-0 border-0 bg-transparent px-0 text-base font-semibold shadow-none ring-0 placeholder:font-medium placeholder:text-muted-foreground/50 focus-visible:ring-0`}
      />

      {error && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
          !
        </span>
      )}
    </div>
  );
}

// ── Page Component ────────────────────────────────────────────

export default function CreateSession() {
  const [formData, setFormData] = useState({
    ownerName: "Chu Phong",
    player1: "An",
    player2: "Binh",
    player3: "Cuong",
    player4: "Dung",
    firstPlaceScore: 3,
    secondPlaceScore: 2,
    thirdPlaceScore: -2,
    fourthPlaceScore: -3,
    redPigScore: 3,
    blackPigScore: 2,
    tripleScore: 20,
    khapScore: 1,
    khapLimit: 10,
    sanhScore: 1,
    sanhLimit: 10,
    nhotPenalty: 2,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const set = (key: keyof typeof formData, val: string | number) =>
    setFormData((prev) => ({ ...prev, [key]: val }));

  // Client-side validation chạy trước khi submit
  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.ownerName.trim())
      errs.ownerName = "Vui long nhap ten chu phong";
    for (let i = 1; i <= 4; i++) {
      const v = formData[`player${i}` as keyof typeof formData] as string;
      if (!v?.trim()) errs[`player${i}`] = `Vui long nhap ten nguoi choi ${i}`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Chỉ validate phía client; submit thật sự qua React Router action
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!validateForm()) {
      e.preventDefault();
    }
    // Nếu valid → để form submit bình thường → action() chạy trên server
  };

  const rankScores = [
    formData.firstPlaceScore,
    formData.secondPlaceScore,
    formData.thirdPlaceScore,
    formData.fourthPlaceScore,
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-primary/15 via-background to-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Spade className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold">Tạo phòng chơi</h1>
              <p className="truncate text-xs text-muted-foreground">
                Thiết lập luật và người chơi cho ván mới
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-5">
        {/* Hero */}
        <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-card p-5 shadow-xl shadow-primary/10">
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                <Zap className="size-4" />
                Thirteen Game
              </div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                Tạo bàn chơi mới
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Nhập tên người chơi và luật điểm. Sau khi tạo, bạn sẽ nhận được
                mã phòng để chia sẻ cho mọi người cùng tham gia.
              </p>
            </div>
            <div className="relative flex shrink-0 items-center gap-3 rounded-3xl bg-primary/10 p-4 text-primary ring-1 ring-primary/15">
              <Crown className="size-7" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Chủ phòng
                </p>
                <p className="text-sm font-bold">{formData.ownerName || "—"}</p>
              </div>
            </div>
          </div>
        </section>

        <form
          id="create-form"
          method="post"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {/* ── Chủ phòng ─────────────────────────────────── */}
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Spade className="size-4" />
                </div>
                Thông tin chủ phòng
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ownerName" className="text-xs font-semibold text-muted-foreground">
                  Tên của bạn
                </Label>
                <Input
                  id="ownerName"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={(e) => {
                    set("ownerName", e.target.value);
                    if (errors.ownerName)
                      setErrors((p) => ({ ...p, ownerName: "" }));
                  }}
                  placeholder="Nhập tên của bạn"
                  className={`h-11 rounded-2xl ${errors.ownerName ? "border-destructive focus-visible:ring-destructive/20" : ""}`}
                />
                {errors.ownerName && (
                  <p className="text-destructive text-xs">{errors.ownerName}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Người chơi ────────────────────────────────── */}
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-chart-2/15 text-chart-2">
                  <Users className="size-4" />
                </div>
                <CardTitle className="text-base">Người chơi</CardTitle>
                <Badge variant="secondary" className="ml-auto rounded-full text-xs">
                  4 người
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[0, 1, 2, 3].map((i) => (
                <PlayerRow
                  key={i}
                  index={i}
                  value={formData[`player${i + 1}` as keyof typeof formData] as string}
                  error={errors[`player${i + 1}`]}
                  onChange={(value) => {
                    set(`player${i + 1}` as keyof typeof formData, value);
                    if (errors[`player${i + 1}`]) {
                      setErrors((p) => ({
                        ...p,
                        [`player${i + 1}`]: "",
                      }));
                    }
                  }}
                />
              ))}
            </CardContent>
          </Card>

          {/* ── Điểm hạng ─────────────────────────────────── */}
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-chart-4/15 text-chart-4">
                  <Trophy className="size-4" />
                </div>
                <CardTitle className="text-base">Điểm hạng</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-2 rounded-3xl border border-border/70 bg-muted/35 p-2">
                {rankScores.map((score, i) => (
                  <div
                    key={i}
                    className={`flex min-h-20 flex-col items-center justify-center rounded-2xl bg-gradient-to-br px-2 py-2 shadow-sm ${RANK_COLORS[i]}`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">
                      Hạng {RANK_LABELS[i]}
                    </span>
                    <span className="mt-1 text-xl font-black">{score > 0 ? `+${score}` : score}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ScoreInput
                  id="firstPlaceScore"
                  label="Hạng nhất"
                  name="firstPlaceScore"
                  value={formData.firstPlaceScore}
                  onChange={(v) =>
                    setFormData((p) => ({
                      ...p,
                      firstPlaceScore: v,
                      fourthPlaceScore:
                        p.fourthPlaceScore === -p.firstPlaceScore
                          ? -v
                          : p.fourthPlaceScore,
                    }))
                  }
                />
                <ScoreInput
                  id="secondPlaceScore"
                  label="Hạng nhì"
                  name="secondPlaceScore"
                  value={formData.secondPlaceScore}
                  onChange={(v) => set("secondPlaceScore", v)}
                />
                <ScoreInput
                  id="thirdPlaceScore"
                  label="Hạng ba"
                  name="thirdPlaceScore"
                  value={formData.thirdPlaceScore}
                  onChange={(v) => set("thirdPlaceScore", v)}
                />
                <ScoreInput
                  id="fourthPlaceScore"
                  label="Hạng tư"
                  name="fourthPlaceScore"
                  value={formData.fourthPlaceScore}
                  onChange={(v) => set("fourthPlaceScore", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Cài đặt nâng cao ──────────────────────────── */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/40 active:bg-muted/70 transition-colors pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Settings className="size-4" />
                      </div>
                      Cài đặt nâng cao
                    </span>
                    <ChevronDown
                      className={`size-4 text-muted-foreground transition-transform duration-200 ${isAdvancedOpen ? "rotate-180" : ""}`}
                    />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="flex flex-col gap-5 pt-0">
                  {/* Heo */}
                  <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="size-4 text-red-500" />
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Điểm heo
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreInput
                        id="redPigScore"
                        label="Heo đỏ"
                        name="redPigScore"
                        hint="đ/người"
                        value={formData.redPigScore}
                        onChange={(v) => set("redPigScore", v)}
                      />
                      <ScoreInput
                        id="blackPigScore"
                        label="Heo đen"
                        name="blackPigScore"
                        hint="đ/người"
                        value={formData.blackPigScore}
                        onChange={(v) => set("blackPigScore", v)}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Khạp */}
                  <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <Flame className="size-4 text-chart-4" />
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Điểm khạp
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreInput
                        id="khapScore"
                        label="Điểm/khạp"
                        name="khapScore"
                        hint="đ/người"
                        value={formData.khapScore}
                        onChange={(v) => set("khapScore", v)}
                      />
                      <ScoreInput
                        id="khapLimit"
                        label="Giới hạn"
                        name="khapLimit"
                        hint="ván"
                        value={formData.khapLimit}
                        onChange={(v) => set("khapLimit", v)}
                      />
                    </div>
                    <div className="flex gap-2 rounded-2xl bg-chart-4/10 p-3 text-xs text-muted-foreground ring-1 ring-chart-4/15">
                      <Flame className="size-4 shrink-0 text-chart-4" />
                      <span>
                        Mỗi khạp tích lũy, người thắng nhận{" "}
                        <strong className="text-chart-4">
                          {formData.khapScore * 3}đ
                        </strong>
                        , 3 người còn lại mỗi người mất{" "}
                        <strong className="text-chart-4">
                          {formData.khapScore}đ
                        </strong>
                        . Tối đa {formData.khapLimit} ván.
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Sảnh */}
                  <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-chart-1" />
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Điểm sảnh
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreInput
                        id="sanhScore"
                        label="Điểm/sảnh"
                        name="sanhScore"
                        hint="đ/người"
                        value={formData.sanhScore}
                        onChange={(v) => set("sanhScore", v)}
                      />
                      <ScoreInput
                        id="sanhLimit"
                        label="Giới hạn"
                        name="sanhLimit"
                        hint="ván"
                        value={formData.sanhLimit}
                        onChange={(v) => set("sanhLimit", v)}
                      />
                    </div>
                    <div className="flex gap-2 rounded-2xl bg-chart-1/10 p-3 text-xs text-muted-foreground ring-1 ring-chart-1/15">
                      <Sparkles className="size-4 shrink-0 text-chart-1" />
                      <span>
                        Mỗi sảnh tích lũy, người thắng nhận{" "}
                        <strong className="text-chart-1">
                          {formData.sanhScore * 3}đ
                        </strong>
                        , 3 người còn lại mỗi người mất{" "}
                        <strong className="text-chart-1">
                          {formData.sanhScore}đ
                        </strong>
                        . Tối đa {formData.sanhLimit} ván.
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Nhốt */}
                  <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <Swords className="size-4 text-chart-3" />
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Nhốt bài
                      </p>
                    </div>
                    <ScoreInput
                      id="nhotPenalty"
                      label="Phạt người ngoài"
                      name="nhotPenalty"
                      hint="đ cố định"
                      value={formData.nhotPenalty}
                      onChange={(v) => set("nhotPenalty", v)}
                    />
                    <div className="flex gap-2 rounded-2xl bg-chart-3/10 p-3 text-xs text-muted-foreground ring-1 ring-chart-3/15">
                      <Target className="size-4 shrink-0 text-chart-3" />
                      <span>
                        Khi nhốt 2 người, người còn lại bị phạt{" "}
                        <strong className="text-chart-3">
                          {formData.nhotPenalty}đ
                        </strong>{" "}
                        cố định.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </form>
      </main>

      {/* Fixed Bottom */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 p-4 backdrop-blur-xl">
        <Button
          type="submit"
          form="create-form"
          className="mx-auto flex h-12 w-full max-w-3xl gap-2 rounded-2xl text-base font-bold shadow-xl shadow-primary/20"
          size="lg"
        >
          <Play className="size-4" />
          Tạo phòng và bắt đầu chơi
        </Button>
      </div>
    </div>
  );
}