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
import { Link, useNavigate } from "react-router";
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
    secondPlaceScore: parseIntField(data, "secondPlaceScore", 1),
    thirdPlaceScore: parseIntField(data, "thirdPlaceScore", -1),
    fourthPlaceScore: parseIntField(data, "fourthPlaceScore", -3),
    redPigScore: parseIntField(data, "redPigScore", 3),
    blackPigScore: parseIntField(data, "blackPigScore", 5),
    tripleScore: parseIntField(data, "tripleScore", 20),
    khapScore: parseIntField(data, "khapScore", 3),
    khapLimit: parseIntField(data, "khapLimit", 5),
    sanhScore: parseIntField(data, "sanhScore", 5),
    sanhLimit: parseIntField(data, "sanhLimit", 3),
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
          status: "waiting",
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
console.log(session.id)
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

const RANK_LABELS = ["Hang 1", "Hang 2", "Hang 3", "Hang 4"];
const RANK_COLORS = [
  "text-chart-4 bg-chart-4/10 border-chart-4/30",
  "text-chart-2 bg-chart-2/10 border-chart-2/30",
  "text-muted-foreground bg-muted/40 border-muted",
  "text-destructive bg-destructive/10 border-destructive/30",
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
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="flex items-center justify-center size-9 rounded-l-md border border-r-0 border-input bg-muted hover:bg-muted/70 text-muted-foreground font-bold transition-colors"
        >
          −
        </button>
        <Input
          id={id}
          type="number"
          name={name}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="rounded-none text-center font-bold h-9 border-x-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex items-center justify-center size-9 rounded-r-md border border-l-0 border-input bg-muted hover:bg-muted/70 text-muted-foreground font-bold transition-colors"
        >
          +
        </button>
      </div>
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
    secondPlaceScore: 1,
    thirdPlaceScore: -1,
    fourthPlaceScore: -3,
    redPigScore: 3,
    blackPigScore: 5,
    tripleScore: 20,
    khapScore: 3,
    khapLimit: 5,
    sanhScore: 5,
    sanhLimit: 3,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/" className="flex items-center justify-center">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Spade className="size-4 text-primary" />
            <h1 className="text-base font-semibold">Tao Phong Choi</h1>
          </div>
        </div>
      </header>

      <main className="pb-28">
        {/*
          method="post" → React Router tự dispatch tới action() của route này
          Không cần action URL rõ ràng vì đây là cùng route file
        */}
        <form
          id="create-form"
          method="post"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-4"
        >
          {/* ── Hidden fields cho các giá trị number từ state ── */}
          {/* Các ScoreInput dùng name= nên tự submit, nhưng thêm hidden
              fields phòng trường hợp input bị uncontrolled */}

          {/* ── Chủ phòng ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex items-center justify-center size-7 rounded-full bg-primary/10 text-primary">
                  <Spade className="size-3.5" />
                </div>
                Chu Phong
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ownerName" className="text-xs font-medium">
                  Ten cua ban
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
                  placeholder="Nhap ten cua ban"
                  className={errors.ownerName ? "border-destructive" : ""}
                />
                {errors.ownerName && (
                  <p className="text-destructive text-xs">{errors.ownerName}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Người chơi ────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex items-center justify-center size-7 rounded-full bg-chart-2/20 text-chart-2">
                  <Users className="size-3.5" />
                </div>
                Nguoi Choi
                <Badge variant="secondary" className="ml-auto text-xs">
                  4 nguoi
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 p-0">
              {[0, 1, 2, 3].map((i) => {
                const key = `player${i + 1}` as keyof typeof formData;
                const err = errors[`player${i + 1}`];
                const rankColor = RANK_COLORS[i];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 ${i < 3 ? "border-b border-muted/60" : ""}`}
                  >
                    <span
                      className={`flex items-center justify-center size-7 rounded-full text-xs font-bold border shrink-0 ${rankColor}`}
                    >
                      {i + 1}
                    </span>
                    <Input
                      id={`player${i + 1}`}
                      name={`player${i + 1}`}
                      value={formData[key] as string}
                      onChange={(e) => {
                        set(key, e.target.value);
                        if (err)
                          setErrors((p) => ({
                            ...p,
                            [`player${i + 1}`]: "",
                          }));
                      }}
                      placeholder={`Ten nguoi choi ${i + 1}`}
                      className={`border-0 shadow-none bg-transparent focus-visible:ring-0 px-0 font-medium ${err ? "placeholder:text-destructive" : ""}`}
                    />
                    {err && (
                      <p className="text-destructive text-xs shrink-0">!</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ── Điểm hạng ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex items-center justify-center size-7 rounded-full bg-chart-4/20 text-chart-4">
                  <Trophy className="size-3.5" />
                </div>
                Diem Hang
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Preview bar */}
              <div className="flex gap-1.5 rounded-lg overflow-hidden border border-muted p-1 bg-muted/30">
                {rankScores.map((score, i) => (
                  <div
                    key={i}
                    className={`flex-1 flex flex-col items-center py-1.5 rounded-md border text-xs font-bold ${RANK_COLORS[i]}`}
                  >
                    <span className="text-[10px] opacity-70 mb-0.5">
                      {RANK_LABELS[i]}
                    </span>
                    <span>{score > 0 ? `+${score}` : score}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ScoreInput
                  id="firstPlaceScore"
                  label="Hang Nhat"
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
                  label="Hang Nhi"
                  name="secondPlaceScore"
                  value={formData.secondPlaceScore}
                  onChange={(v) => set("secondPlaceScore", v)}
                />
                <ScoreInput
                  id="thirdPlaceScore"
                  label="Hang Ba"
                  name="thirdPlaceScore"
                  value={formData.thirdPlaceScore}
                  onChange={(v) => set("thirdPlaceScore", v)}
                />
                <ScoreInput
                  id="fourthPlaceScore"
                  label="Hang Tu"
                  name="fourthPlaceScore"
                  value={formData.fourthPlaceScore}
                  onChange={(v) => set("fourthPlaceScore", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Cài đặt nâng cao ──────────────────────────── */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors rounded-xl pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <div className="flex items-center justify-center size-7 rounded-full bg-muted text-muted-foreground">
                        <Settings className="size-3.5" />
                      </div>
                      Cai Dat Nang Cao
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
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="size-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Diem Heo
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreInput
                        id="redPigScore"
                        label="Heo Do"
                        name="redPigScore"
                        hint="đ/nguoi"
                        value={formData.redPigScore}
                        onChange={(v) => set("redPigScore", v)}
                      />
                      <ScoreInput
                        id="blackPigScore"
                        label="Heo Den"
                        name="blackPigScore"
                        hint="đ/nguoi"
                        value={formData.blackPigScore}
                        onChange={(v) => set("blackPigScore", v)}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Khạp */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Flame className="size-3.5 text-chart-4" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Diem Khap
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreInput
                        id="khapScore"
                        label="Diem/Khap"
                        name="khapScore"
                        hint="đ/nguoi"
                        value={formData.khapScore}
                        onChange={(v) => set("khapScore", v)}
                      />
                      <ScoreInput
                        id="khapLimit"
                        label="Gioi Han"
                        name="khapLimit"
                        hint="van"
                        value={formData.khapLimit}
                        onChange={(v) => set("khapLimit", v)}
                      />
                    </div>
                    <div className="flex gap-1.5 p-2.5 rounded-lg bg-chart-4/5 border border-chart-4/20 text-xs text-muted-foreground">
                      <Flame className="size-3.5 text-chart-4 shrink-0 mt-0.5" />
                      <span>
                        Moi khap tich luy, nguoi thang nhan{" "}
                        <strong className="text-chart-4">
                          {formData.khapScore * 3}đ
                        </strong>
                        , 3 nguoi con lai moi nguoi mat{" "}
                        <strong className="text-chart-4">
                          {formData.khapScore}đ
                        </strong>
                        . Toi da {formData.khapLimit} van.
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Sảnh */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-3.5 text-chart-1" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Diem Sanh
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreInput
                        id="sanhScore"
                        label="Diem/Sanh"
                        name="sanhScore"
                        hint="đ/nguoi"
                        value={formData.sanhScore}
                        onChange={(v) => set("sanhScore", v)}
                      />
                      <ScoreInput
                        id="sanhLimit"
                        label="Gioi Han"
                        name="sanhLimit"
                        hint="van"
                        value={formData.sanhLimit}
                        onChange={(v) => set("sanhLimit", v)}
                      />
                    </div>
                    <div className="flex gap-1.5 p-2.5 rounded-lg bg-chart-1/5 border border-chart-1/20 text-xs text-muted-foreground">
                      <Sparkles className="size-3.5 text-chart-1 shrink-0 mt-0.5" />
                      <span>
                        Moi sanh tich luy (1 lan/van), nguoi thang nhan{" "}
                        <strong className="text-chart-1">
                          {formData.sanhScore * 3}đ
                        </strong>
                        , 3 nguoi con lai moi nguoi mat{" "}
                        <strong className="text-chart-1">
                          {formData.sanhScore}đ
                        </strong>
                        . Toi da {formData.sanhLimit} van.
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Nhốt */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Swords className="size-3.5 text-chart-3" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Nhot Bai
                      </p>
                    </div>
                    <ScoreInput
                      id="nhotPenalty"
                      label="Phat Nguoi Ngoai (Nhot 2)"
                      name="nhotPenalty"
                      hint="đ cố định"
                      value={formData.nhotPenalty}
                      onChange={(v) => set("nhotPenalty", v)}
                    />
                    <div className="flex gap-1.5 p-2.5 rounded-lg bg-chart-3/5 border border-chart-3/20 text-xs text-muted-foreground">
                      <Swords className="size-3.5 text-chart-3 shrink-0 mt-0.5" />
                      <span>
                        Khi nhot 2 nguoi, nguoi con lai bi phat{" "}
                        <strong className="text-chart-3">
                          {formData.nhotPenalty}đ
                        </strong>{" "}
                        co dinh.
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
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4">
        <Button
          type="submit"
          form="create-form"
          className="w-full gap-2"
          size="lg"
        >
          <Play className="size-4" />
          Bat Dau Choi
        </Button>
      </div>
    </div>
  );
}
