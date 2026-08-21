import {
  Outlet,
  Link,
  useParams,
  useLocation,
  useNavigate,
  useRevalidator,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import type { Route } from "./+types/layout";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { gameConfigs } from "~/db/schema/game-configs";
import { players as playersSchema } from "~/db/schema/players";
import { eq, asc, and } from "drizzle-orm";
import { redirect } from "react-router";
import { ModeToggle } from "~/components/mode-toggle";
import { ThemeProvider } from "~/components/theme-provider";
import {
  Home,
  Clock,
  Settings,
  Spade,
  BarChart2,
  Swords,
  LucideLogOut,
  LogOut,
  Power,
  CornerDownLeft,
  IterationCw,
} from "lucide-react";
import {
  useCurrentParticipant,
  useSession,
  useMySelectedPlayer,
  usePlayers,
  useSessionStore,
  type ActiveSession,
  type GameConfig,
  type Player,
  type SessionParticipant,
} from "~/stores/useSessionStore";
import { useState, useEffect, useRef } from "react";
import { joinSession, leaveSession } from "~/lib/socket.client";
import {
  onJoinRequestCreated,
  onParticipantApproved,
  onJoinRequestRejected,
  onParticipantKicked,
  offJoinRequestCreated,
  offParticipantApproved,
  offJoinRequestRejected,
  offParticipantKicked,
  onPlayerSelected,
  onPlayerDeselected,
  offPlayerSelected,
  offPlayerDeselected,
  onScoreUpdated,
  offScoreUpdated,
  type PlayerSelectedEvent,
  type PlayerDeselectedEvent,
  type ScoreUpdatedEvent,
  approveJoinRequest,
  rejectJoinRequest,
} from "~/lib/socket.client";
import { createFingerprint } from "~/helpers/fingerprint.helper";
import { Background } from "~/components/background";
import { Button } from "~/components/ui/button";
import { Toaster } from "~/components/ui/toaster";
import {
  addToast,
  dismissToastByRequestId,
  clearToasts,
} from "~/stores/useToastStore";
import { playTTS } from "~/helpers/match.helper";

const FINGERPRINT_KEY = "device_fingerprint";

// ── Types ─────────────────────────────────────────────────────

/** Dữ liệu chung của session — không phụ thuộc participant/thiết bị */
interface SessionBaseData {
  session: ActiveSession;
  config: GameConfig;
  players: Player[];
}

/** Dữ liệu đầy đủ trả về cho component, giống hệt shape khi còn dùng cookie */
export interface SessionLoaderData extends SessionBaseData {
  currentParticipant: SessionParticipant;
}

// ── Server Loader ─────────────────────────────────────────────
//
// Không dùng cookie nữa. Loader chỉ trả về dữ liệu chung của session
// (không phụ thuộc thiết bị). currentParticipant được resolve ở clientLoader
// dựa trên device fingerprint (chỉ tồn tại ở client/localStorage).

export async function loader({
  params,
}: Route.LoaderArgs): Promise<SessionBaseData> {
  const { sessionId } = params;

  // 1. Tìm session theo code
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.code, sessionId), eq(sessions.status, "active")))
    .limit(1);

  if (!session) throw redirect("/");

  // 2. Config
  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.sessionId, session.id))
    .limit(1);

  if (!config) throw redirect("/");

  // 3. Players
  const playerList = await db
    .select()
    .from(playersSchema)
    .where(eq(playersSchema.sessionId, session.id))
    .orderBy(asc(playersSchema.orderNo));

  return {
    session: {
      id: session.id,
      code: session.code,
      status: session.status as ActiveSession["status"],
      ownerParticipantId: session.ownerParticipantId!,
      createdAt: session.createdAt.toISOString(),
    },
    config: {
      id: config.id,
      firstPlaceScore: config.firstPlaceScore,
      secondPlaceScore: config.secondPlaceScore,
      thirdPlaceScore: config.thirdPlaceScore,
      fourthPlaceScore: config.fourthPlaceScore,
      redPigScore: config.redPigScore,
      blackPigScore: config.blackPigScore,
      tripleScore: config.tripleScore,
      khapScore: config.khapScore,
      khapLimit: config.khapLimit,
      sanhScore: config.sanhScore,
      sanhLimit: config.sanhLimit,
    },
    players: playerList.map((p) => ({
      id: p.id,
      name: p.name,
      orderNo: p.orderNo,
      initialScore: p.initialScore,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {}

export function shouldRevalidate({
  currentParams,
  nextParams,
  formAction,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formAction?.includes("/settings")) {
    return true; // action từ trang settings luôn phải revalidate layout
  }
  if (currentParams.sessionId === nextParams.sessionId) {
    return false;
  }
  return defaultShouldRevalidate;
}

// ── Fingerprint helper ──────────────────────────────────────
//
// Giống pattern ở home.tsx: lấy hoặc tạo fingerprint từ localStorage.

async function getOrCreateFingerprint(): Promise<string> {
  const existing = localStorage.getItem(FINGERPRINT_KEY);
  if (existing) return existing;

  const fingerprint = await createFingerprint();
  localStorage.setItem(FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

// ── Client Loader ─────────────────────────────────────────────
//
// 1. Lấy dữ liệu chung của session từ server loader.
// 2. Session đã 'finished' -> redirect về trang chủ.
// 3. Không có fingerprint (thiết bị lạ, chưa từng vào phòng) -> /join/:sessionCode
// 4. Có fingerprint nhưng không resolve được participant đang active trong
//    session này (chưa join / đã left) -> /join/:sessionCode
// 5. Thành công -> hydrate store & trả về currentParticipant đầy đủ, giống
//    hệt shape dữ liệu khi còn dùng cookie.

export async function clientLoader({
  params,
  serverLoader,
}: Route.ClientLoaderArgs): Promise<SessionLoaderData> {
  const data = await serverLoader();
  const sessionCode = params.sessionId!;

  if (data.session.status === "finished") {
    throw redirect("/");
  }

  const fingerprint = await getOrCreateFingerprint();

  const currentParticipant = await resolveParticipant(sessionCode, fingerprint);
  if (!currentParticipant) {
    throw redirect(`/join/${sessionCode}`);
  }

  // Lưu nhân vật mà người tham gia này đã chọn (dùng để push notification
  // khi nhân vật có biến động điểm / thứ hạng sau mỗi ván).
  useSessionStore
    .getState()
    .setMySelectedPlayer(currentParticipant.selectedPlayerId);

  const showBackground = localStorage.getItem("showBackground") === "true";
  const enableTTS = localStorage.getItem("textToSpeed") === "true";
  const playerPositions = JSON.parse(
    localStorage.getItem("player-positions") || "[]",
  );

  const loaderData: SessionLoaderData = {
    ...data,
    players: data.players
      .map((p, i) => {
        const player = playerPositions.find((pp: any) => pp.id === p.id);
        return {
          ...p,
          orderNo: player?.orderNo ?? p.orderNo,
        };
      })
      .sort((a, b) => a.orderNo - b.orderNo),
    config: { ...data.config, showBackground, enableTTS },
    currentParticipant,
  };

  useSessionStore.getState().hydrate(loaderData);

  return loaderData;
}

clientLoader.hydrate = true as const;

/**
 * Resolve currentParticipant theo fingerprint trong đúng session này.
 * Trả về null nếu thiết bị chưa join / đã "left" khỏi session.
 */
async function resolveParticipant(
  sessionCode: string,
  fingerprint: string,
): Promise<(SessionParticipant & { selectedPlayerId: string | null }) | null> {
  try {
    const res = await fetch(
      `/api/sessions/${sessionCode}/devices/active?fingerprint=${encodeURIComponent(
        fingerprint,
      )}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      participant: SessionParticipant & { selectedPlayerId: string | null };
    };
    return data.participant ?? null;
  } catch {
    return null;
  }
}

// ── Hydrate Fallback ──────────────────────────────────────────
//
// Hiện trong lúc clientLoader đang chạy (lần load đầu tiên) — thay cho
// việc chặn render server-side như bản dùng cookie trước đây.

export function HydrateFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    </div>
  );
}

// ── Client Action — đăng ký thiết bị ─────────────────────────
//
// Chạy hoàn toàn trên browser, không có server action tương ứng.
// Gọi API route riêng để upsert player_devices.

async function registerDevice(
  sessionId: string,
  participantId: string,
): Promise<void> {
  const fingerprint = await getOrCreateFingerprint();

  // 1. Nhận diện platform
  const ua = navigator.userAgent.toLowerCase();
  const platform = /iphone|ipad|ipod/.test(ua)
    ? "ios"
    : /android/.test(ua)
      ? "android"
      : "web";

  // 2. Gọi API upsert device (không block UI nếu lỗi)
  try {
    await fetch(`/api/sessions/${sessionId}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, fingerprint, platform }),
    });
  } catch {
    // Không critical — bỏ qua lỗi network
  }

  // 3. Request push permission & lấy token (nếu browser hỗ trợ)
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    });

    const pushToken = JSON.stringify(subscription);

    await fetch(`/api/sessions/${sessionId}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, fingerprint, platform, pushToken }),
    });
  } catch {
    // Push subscription thất bại (user từ chối hoặc không hỗ trợ) — bỏ qua
  }
}

/**
 * Đánh dấu thiết bị hiện tại đã "thoát khỏi phòng":
 * cập nhật player_devices.status = 'left' cho fingerprint này trong session.
 */
async function markDeviceLeft(sessionCode: string): Promise<void> {
  const fingerprint = await getOrCreateFingerprint();

  try {
    await fetch(`/api/sessions/${sessionCode}/devices/leave`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint }),
      // Đảm bảo request có cơ hội hoàn tất dù đang điều hướng đi
      keepalive: true,
    });
  } catch {
    // Không critical — bỏ qua lỗi network
  }
}

// ── Meta ──────────────────────────────────────────────────────

export function meta({ data }: Route.MetaArgs) {
  const loaderData = data as SessionLoaderData | undefined;
  return [{ title: `Phong ${loaderData?.session.code ?? ""} - Thirteen Game` }];
}

// ── Component ─────────────────────────────────────────────────

export default function SessionLayout() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLeaving, setIsLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const session = useSession();
  const currentParticipant = useCurrentParticipant();
  const mySelectedPlayerId = useMySelectedPlayer();
  const players = usePlayers();

  // Bảng điểm gần nhất (theo playerId) — dùng để tính biến động khi có
  // round mới / xoá round. Reset khi đổi nhân vật được chọn.
  const scoreRef = useRef<Array<{ playerId: string; totalScore: number }> | null>(
    null,
  );

  // Đăng ký thiết bị sau khi hydrate xong
  useEffect(() => {
    if (!session?.id || !currentParticipant?.id) return;
    registerDevice(session.id, currentParticipant.id);
  }, [session?.id, currentParticipant?.id]);

  // Đổi nhân vật được chọn → xoá lịch sử điểm cũ để tránh tính sai biến động
  useEffect(() => {
    scoreRef.current = null;
  }, [mySelectedPlayerId]);

  // Socket
  useEffect(() => {
    if (!sessionId || !currentParticipant?.id) return;

    joinSession(
      sessionId,
      currentParticipant.id,
      currentParticipant.displayName,
    );

    return () => {
      leaveSession(sessionId);
    };
  }, [sessionId, currentParticipant?.id]);

  // Realtime: yêu cầu tham gia / duyệt / từ chối / đá người chơi
  const revalidator = useRevalidator();

  // Toast là session-scoped: xoá sạch khi rời/switch session (không xoá khi
  // đổi tab vì layout không unmount). Tránh toast cũ (vd: "bị đá khỏi phòng")
  // hiện lại khi user bị đá rồi tham gia lại.
  useEffect(() => {
    return () => {
      clearToasts();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const code = session?.code ?? sessionId;
    const isOwner =
      !!currentParticipant &&
      session?.ownerParticipantId === currentParticipant.id;

    const handleCreated = ({
      requestId,
      displayName,
    }: {
      requestId: string;
      displayName: string;
    }) => {
      if (!isOwner) return;
      addToast({
        requestId,
        title: `${displayName} muốn tham gia`,
        description: "Phê duyệt hoặc từ chối yêu cầu này.",
        duration: 1000 * 60 * 60 * 24 * 20,
        actions: [
          {
            label: "Duyệt",
            onClick: () => approveJoinRequest(code, requestId, displayName),
          },
          {
            label: "Từ chối",
            variant: "destructive",
            onClick: () => rejectJoinRequest(code, requestId, displayName),
          },
        ],
      });
      revalidator.revalidate();
    };

    const handleApproved = ({ requestId }: { requestId: string }) => {
      dismissToastByRequestId(requestId);
      revalidator.revalidate();
    };

    const handleRejected = ({ requestId }: { requestId: string }) => {
      dismissToastByRequestId(requestId);
      revalidator.revalidate();
    };

    const handleKicked = async ({
      participantId,
      sessionCode,
    }: {
      participantId: string;
      sessionCode: string;
    }) => {
      revalidator.revalidate();
      if (currentParticipant && participantId === currentParticipant.id) {
        addToast({
          title: "Bạn đã bị đá khỏi phòng",
          variant: "destructive",
          duration: 4000,
        });
        await markDeviceLeft(sessionCode);
        navigate(`/join/${sessionCode}`);
      }
    };

    onJoinRequestCreated(handleCreated);
    onParticipantApproved(handleApproved);
    onJoinRequestRejected(handleRejected);
    onParticipantKicked(handleKicked);

    // Push notification: có người chọn / bỏ chọn nhân vật.
    // Không toast cho chính người thao tác (họ đã biết), nhưng vẫn broadcast
    // cho toàn bộ room — nên chủ phòng và mọi người tham gia đều nhận được
    // thông báo về lựa chọn của người khác.
    const handlePlayerSelected = (data: PlayerSelectedEvent) => {
      if (currentParticipant && data.participantId === currentParticipant.id)
        return;
      revalidator.revalidate();
      addToast({
        title: `${data.displayName} đã chọn nhân vật`,
        description: data.playerName,
        duration: 4000,
      });
    };

    const handlePlayerDeselected = (data: PlayerDeselectedEvent) => {
      if (currentParticipant && data.participantId === currentParticipant.id)
        return;
      revalidator.revalidate();
      addToast({
        title: `${data.displayName} đã bỏ chọn nhân vật`,
        description: data.playerName,
        duration: 4000,
      });
    };

    onPlayerSelected(handlePlayerSelected);
    onPlayerDeselected(handlePlayerDeselected);

    // Push notification: nhân vật của người tham gia có biến động điểm lớn
    // hoặc thay đổi thứ hạng sau mỗi ván (chỉ thông báo thiết bị đã chọn
    // nhân vật đó).
    const rankOf = (
      totals: Array<{ playerId: string; totalScore: number }>,
      playerId: string,
    ): number | null => {
      const sorted = [...totals].sort((a, b) => b.totalScore - a.totalScore);
      const idx = sorted.findIndex((t) => t.playerId === playerId);
      return idx === -1 ? null : idx + 1;
    };

    const handleScoreUpdated = ({ totals }: ScoreUpdatedEvent) => {
      const myPlayerId =
        useSessionStore.getState().mySelectedPlayerId;
      if (!myPlayerId) return;

      const prev = scoreRef.current;
      const oldTotal = prev
        ? prev.find((t) => t.playerId === myPlayerId)?.totalScore
        : undefined;
      const newTotal = totals.find(
        (t) => t.playerId === myPlayerId,
      )?.totalScore;
      if (newTotal == null) return;

      const oldRank = prev ? rankOf(prev, myPlayerId) : null;
      const newRank = rankOf(totals, myPlayerId);

      const delta = oldTotal == null ? 0 : newTotal - oldTotal;
      // Ngưỡng "biến động lớn" — chỉnh ở đây (điểm).
      const SWING_THRESHOLD = 30;
      const bigSwing = oldTotal != null && Math.abs(delta) >= SWING_THRESHOLD;
      const rankChanged =
        oldRank != null && newRank != null && oldRank !== newRank;

      if (oldRank != null && (bigSwing || rankChanged)) {
        const player = players.find((p) => p.id === myPlayerId);
        const name = player?.name ?? "Nhân vật của bạn";
        const parts: string[] = [];
        if (rankChanged) parts.push(`hạng ${oldRank} → ${newRank}`);
        if (bigSwing)
          parts.push(`${delta > 0 ? "+" : ""}${delta} điểm`);
        addToast({
          title: `${name} có biến động`,
          description: parts.join(" · "),
          duration: 5000,
        });
      }

      scoreRef.current = totals;
    };

    onScoreUpdated(handleScoreUpdated);

    return () => {
      offJoinRequestCreated(handleCreated);
      offParticipantApproved(handleApproved);
      offJoinRequestRejected(handleRejected);
      offParticipantKicked(handleKicked);
      offPlayerSelected(handlePlayerSelected);
      offPlayerDeselected(handlePlayerDeselected);
      offScoreUpdated(handleScoreUpdated);
    };
  }, [
    sessionId,
    session?.code,
    session?.ownerParticipantId,
    currentParticipant?.id,
    revalidator,
    navigate,
  ]);

  // Thoát phòng: cập nhật trạng thái thiết bị (status = 'left') rồi điều hướng về trang chủ
  const handleLeaveRoom = async () => {
    if (!sessionId || isLeaving) return;
    setIsLeaving(true);
    await markDeviceLeft(sessionId);
    navigate("/");
  };

  const leftTabs = [
    { to: `/session/${sessionId}`, label: "Xếp hạng", icon: Home, exact: true },
    {
      to: `/session/${sessionId}/history`,
      label: "Lịch Sử",
      icon: Clock,
      exact: false,
    },
  ];

  const rightTabs = [
    {
      to: `/session/${sessionId}/chart`,
      label: "Thống Kê",
      icon: BarChart2,
      exact: false,
    },
    {
      to: `/session/${sessionId}/settings`,
      label: "Cấu Hình",
      icon: Settings,
      exact: false,
    },
  ];

  const centerTab = {
    to: `/session/${sessionId}/match`,
    label: "Ván Đấu",
    icon: Swords,
    exact: false,
  };

  const isTabActive = (tab: { to: string; exact: boolean }) =>
    tab.exact
      ? location.pathname === tab.to
      : location.pathname.startsWith(tab.to);

  const isCenterActive = isTabActive(centerTab);

  const TabItem = ({
    tab,
  }: {
    tab: { to: string; label: string; icon: any; exact: boolean };
  }) => {
    const active = isTabActive(tab);
    const Icon = tab.icon;

    return (
      <Link
        to={tab.to}
        className={`group flex min-w-0 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all ${
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        <span
          className={`flex size-9 items-center justify-center rounded-2xl transition-all ${
            active
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
              : "bg-transparent group-hover:bg-background/70"
          }`}
        >
          <Icon
            className={`size-5 transition-transform ${active ? "-translate-y-0.5" : ""}`}
          />
        </span>
        <span className="w-full truncate text-center text-[10px] font-semibold leading-none sm:text-[11px]">
          {tab.label}
        </span>
      </Link>
    );
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="relative min-h-dvh overflow-hidden bg-background pb-[calc(6.25rem_+_env(safe-area-inset-bottom))]">
        {/* <div className="bg-fixed"></div> */}
        <Background />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-primary/10 to-transparent" />

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/70 bg-background/10 backdrop-blur-xs">
          <div className="mx-auto flex min-h-16 max-w-[430px] items-center bg-background/50 justify-between gap-2 px-3 py-2 sm:max-w-lg sm:px-4">
            <Link
              to="/"
              className="group flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-primary/5"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-lg shadow-primary/20 transition group-hover:scale-[1.03]">
                <Spade className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-foreground">
                  Thirteen Game
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Phòng {session?.code ?? "realtime"}
                </p>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-1 shadow-sm">
              {!confirmLeave ? (
                <>
                  <ModeToggle />
                  <button
                    // onClick={handleLeaveRoom}
                    onClick={() => setConfirmLeave(true)}
                    disabled={isLeaving}
                    className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    title="Thoát phòng"
                  >
                    <LucideLogOut className="size-5" />
                  </button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmLeave(false)}
                  >
                    <IterationCw /> Hủy
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLeaveRoom}
                  >
                    Thoát <Power />
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <Outlet />

        <Toaster />

        {/* Mobile-first Bottom Tab Bar: 5 equal columns */}
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/92 px-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] pt-2 shadow-[0_-20px_50px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto grid w-full max-w-[430px] grid-cols-5 items-end justify-center gap-0.5 px-1.5 sm:max-w-lg sm:px-0">
            {leftTabs.map((tab) => (
              <TabItem key={tab.to} tab={tab} />
            ))}

            {/* Center FAB */}
            <div className="col-span-1 flex flex-col items-center justify-center -mt-7">
              <Link
                to={centerTab.to}
                aria-label="Ván Đấu"
                className={`relative flex items-center justify-center size-14 rounded-full border-[5px] border-background shadow-xl transition-all active:scale-95 ${
                  isCenterActive
                    ? "bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-2xl shadow-primary/35"
                    : "bg-primary text-primary-foreground shadow-xl shadow-primary/30"
                }`}
              >
                <Swords className="size-6" />
              </Link>
              <span
                className={`mt-1 w-full truncate text-center text-[10px] font-semibold ${
                  isCenterActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {centerTab.label}
              </span>
            </div>

            {rightTabs.map((tab) => (
              <TabItem key={tab.to} tab={tab} />
            ))}
          </div>
        </nav>
      </div>
    </ThemeProvider>
  );
}
