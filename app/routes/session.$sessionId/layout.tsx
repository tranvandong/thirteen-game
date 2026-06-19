import {
  Outlet,
  Link,
  useParams,
  useLocation,
  useNavigate,
} from "react-router";
import type { Route } from "./+types/layout";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { gameConfigs } from "~/db/schema/game-configs";
import { players as playersSchema } from "~/db/schema/players";
import { participants } from "~/db/schema/participants";
import { playerDevices } from "~/db/schema/player-devices";
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
} from "lucide-react";
import {
  useCurrentParticipant,
  useSession,
  useSessionStore,
  type ActiveSession,
  type GameConfig,
  type Player,
  type SessionParticipant,
} from "~/stores/useSessionStore";
import { useEffect } from "react";
import {
  joinSession,
  leaveSession,
} from "~/lib/socket.client";

// ── Helpers cookie ────────────────────────────────────────────

const PARTICIPANT_COOKIE = "participant_id";

function getParticipantIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith(`${PARTICIPANT_COOKIE}=`));
  return match ? decodeURIComponent(match.trim().split("=")[1]) : null;
}

function setParticipantCookie(participantId: string): string {
  return `${PARTICIPANT_COOKIE}=${encodeURIComponent(participantId)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

// ── Types ─────────────────────────────────────────────────────

export interface SessionLoaderData {
  session: ActiveSession;
  config: GameConfig;
  players: Player[];
  currentParticipant: SessionParticipant;
}

// ── Server Loader ─────────────────────────────────────────────

export async function loader({
  params,
  request,
}: Route.LoaderArgs): Promise<Response | SessionLoaderData> {
  const { sessionId } = params;
  const cookieHeader = request.headers.get("Cookie");
  const participantIdFromCookie = getParticipantIdFromCookie(cookieHeader);

  // 1. Tìm session theo code
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionId))
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

  // 4. Resolve currentParticipant từ cookie
  //    Không có cookie hoặc participant không thuộc session → redirect sang /join
  let currentParticipant: typeof participants.$inferSelect | undefined;

  if (participantIdFromCookie) {
    const [found] = await db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.id, participantIdFromCookie),
          eq(participants.sessionId, session.id),
        ),
      )
      .limit(1);
    currentParticipant = found;
  }

  // Exception: nếu chưa có cookie nhưng đây là owner (vừa tạo phòng,
  // action tạo phòng chưa set cookie) → dùng owner làm mặc định 1 lần
  // và set cookie ngay. Production nên set cookie ngay tại action tạo phòng.
  if (!currentParticipant && session.ownerParticipantId) {
    const [owner] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, session.ownerParticipantId))
      .limit(1);
    currentParticipant = owner;
  }

  if (!currentParticipant) {
    throw redirect(`/session/${sessionId}/join`);
  }

  const loaderData: SessionLoaderData = {
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
    })),
    currentParticipant: {
      id: currentParticipant.id,
      displayName: currentParticipant.displayName,
      role: currentParticipant.role as SessionParticipant["role"],
    },
  };

  // Set cookie nếu chưa có hoặc khác participant hiện tại
  if (participantIdFromCookie !== currentParticipant.id) {
    return new Response(JSON.stringify(loaderData), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setParticipantCookie(currentParticipant.id),
      },
    });
  }

  return loaderData;
}

// ── Client Loader ─────────────────────────────────────────────

export async function clientLoader({
  serverLoader,
}: Route.ClientLoaderArgs): Promise<SessionLoaderData> {
  const data = await serverLoader();
  useSessionStore.getState().hydrate(data);
  return data;
}

clientLoader.hydrate = true as const;

// ── Client Action — đăng ký thiết bị ─────────────────────────
//
// Chạy hoàn toàn trên browser, không có server action tương ứng.
// Gọi API route riêng để upsert player_devices.

async function registerDevice(
  sessionId: string,
  participantId: string,
): Promise<void> {
  // 1. Lấy hoặc tạo fingerprint
  let fingerprint = localStorage.getItem("device_fingerprint");
  if (!fingerprint) {
    // Sinh fingerprint đơn giản từ các thuộc tính trình duyệt
    // Production nên dùng @fingerprintjs/fingerprintjs
    const raw = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency ?? "",
    ].join("|");
    const msgBuffer = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    fingerprint = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 64);
    localStorage.setItem("device_fingerprint", fingerprint);
  }

  // 2. Nhận diện platform
  const ua = navigator.userAgent.toLowerCase();
  const platform = /iphone|ipad|ipod/.test(ua)
    ? "ios"
    : /android/.test(ua)
      ? "android"
      : "web";

  // 3. Gọi API upsert device (không block UI nếu lỗi)
  try {
    await fetch(`/api/sessions/${sessionId}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, fingerprint, platform }),
    });
  } catch {
    // Không critical — bỏ qua lỗi network
  }

  // 4. Request push permission & lấy token (nếu browser hỗ trợ)
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

  const session = useSession();
  const currentParticipant = useCurrentParticipant();

  // Đăng ký thiết bị sau khi hydrate xong
  useEffect(() => {
    if (!session?.id || !currentParticipant?.id) return;
    registerDevice(session.id, currentParticipant.id);
  }, [session?.id, currentParticipant?.id]);

  // Socket
  useEffect(() => {
    if (!sessionId || !currentParticipant?.id) return;

    joinSession(sessionId, currentParticipant.id, currentParticipant.displayName);

    return () => {
      leaveSession(sessionId);
    };
  }, [sessionId, currentParticipant?.id]);

  const leftTabs = [
    { to: `/session/${sessionId}`, label: "Xếp hạng", icon: Home, exact: true },
    { to: `/session/${sessionId}/history`, label: "Lịch Sử", icon: Clock, exact: false },
  ];

  const rightTabs = [
    { to: `/session/${sessionId}/chart`, label: "Thống Kê", icon: BarChart2, exact: false },
    { to: `/session/${sessionId}/settings`, label: "Cấu Hình", icon: Settings, exact: false },
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
        className={`group flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2 transition-all ${
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
          <Icon className={`size-5 transition-transform ${active ? "-translate-y-0.5" : ""}`} />
        </span>
        <span className="text-[11px] font-semibold leading-none">
          {tab.label}
        </span>
      </Link>
    );
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="relative min-h-screen overflow-hidden bg-background pb-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-primary/10 to-transparent" />

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-3 px-4">
            <Link
              to="/"
              className="group flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-primary/5"
            >
              <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-lg shadow-primary/20 transition group-hover:scale-[1.03]">
                <Spade className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-foreground">
                  Thirteen Game
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Phòng chơi realtime
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-1 shadow-sm">
              <ModeToggle />
              <button
                onClick={() => navigate("/")}
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                title="Thoát phòng"
              >
                <LucideLogOut className="size-5" />
              </button>
            </div>
          </div>
        </header>

        <Outlet />

        {/* Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/70 bg-background/90 px-3 pb-2 pt-2 shadow-[0_-20px_50px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-16 max-w-lg items-center gap-1">
            {leftTabs.map((tab) => (
              <TabItem key={tab.to} tab={tab} />
            ))}

            {/* Center FAB */}
            <div className="flex flex-col items-center justify-center flex-shrink-0 px-2 -mt-7">
              <Link
                to={centerTab.to}
                className={`relative flex items-center justify-center size-16 rounded-full border-4 border-background shadow-xl transition-all active:scale-95 ${
                  isCenterActive
                    ? "bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-2xl shadow-primary/35"
                    : "bg-primary text-primary-foreground shadow-xl shadow-primary/30"
                }`}
              >
                <Swords className="size-6" />
              </Link>
              <span
                className={`mt-1 text-[11px] font-semibold ${
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