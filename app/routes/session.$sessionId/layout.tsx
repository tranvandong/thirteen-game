import { Outlet, Link, useParams, useLocation } from "react-router";
import type { Route } from "./+types/layout";
// import { db } from "~/db/client.server";
// import { sessions } from "~/db/schema/sessions";
// import { eq } from "drizzle-orm";
import { ModeToggle } from "~/components/mode-toggle";
import { ThemeProvider } from "~/components/theme-provider";
import { Home, Clock, Settings, Spade, BarChart2, Swords } from "lucide-react";

import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { gameConfigs } from "~/db/schema/game-configs";
import { players as playersSchema } from "~/db/schema/players";
import { participants } from "~/db/schema/participants";
import { eq, asc } from "drizzle-orm";
import { redirect, useLoaderData } from "react-router";
import {
  useSessionStore,
  type ActiveSession,
  type GameConfig,
  type Player,
  type SessionParticipant,
} from "~/stores/useSessionStore";

// ── Types trả về từ loader ────────────────────────────────────

export interface SessionLoaderData {
  session: ActiveSession;
  config: GameConfig;
  players: Player[];
  /**
   * currentParticipant được resolve từ cookie/session auth.
   * Ở đây dùng owner làm mặc định cho flow "vừa tạo phòng".
   * Sau này thay bằng logic auth thực.
   */
  currentParticipant: SessionParticipant;
}

// ── Server Loader ─────────────────────────────────────────────

export async function loader({
  params,
}: Route.LoaderArgs): Promise<SessionLoaderData> {
  const { sessionId } = params;

  // 1. Tìm session theo code
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionId))
    .limit(1);

  if (!session) {
    throw redirect("/");
  }

  // 2. Lấy game config
  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.sessionId, session.id))
    .limit(1);

  if (!config) {
    throw redirect("/");
  }

  // 3. Lấy danh sách players (đã sắp xếp theo orderNo)
  const players = await db
    .select()
    .from(playersSchema)
    .where(eq(playersSchema.sessionId, session.id))
    .orderBy(asc(playersSchema.orderNo));

  // 4. Lấy owner participant
  const [owner] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, session.ownerParticipantId!))
    .limit(1);

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
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      orderNo: p.orderNo,
    })),
    currentParticipant: {
      id: owner.id,
      displayName: owner.displayName,
      role: owner.role as SessionParticipant["role"],
    },
  };
}

// ── Client Loader ─────────────────────────────────────────────

/**
 * clientLoader chạy trên browser sau server loader.
 * Nhận data từ server và hydrate Zustand store ngay lập tức —
 * trước khi component render, tránh flash trạng thái rỗng.
 *
 * `clientLoader.hydrate = true` bắt React Router v7 chạy
 * clientLoader ngay cả khi đây là lần đầu load (SSR hydration).
 */
export async function clientLoader({
  serverLoader,
}: Route.ClientLoaderArgs): Promise<SessionLoaderData> {
  const data = await serverLoader();

  // Hydrate store ngay tại đây — đồng bộ với navigation
  useSessionStore.getState().hydrate(data);

  return data;
}

clientLoader.hydrate = true as const;

// ── Meta ──────────────────────────────────────────────────────

export function meta({ data }: Route.MetaArgs) {
  const loaderData = data as SessionLoaderData | undefined;
  return [{ title: `Phong ${loaderData?.session.code ?? ""} - Thirteen Game` }];
}

export default function SessionLayout() {
  const { sessionId } = useParams();
  const location = useLocation();

  const leftTabs = [
    {
      to: `/session/${sessionId}`,
      label: "Phong",
      icon: Home,
      exact: true,
    },
    {
      to: `/session/${sessionId}/history`,
      label: "Lich Su",
      icon: Clock,
      exact: false,
    },
  ];

  const rightTabs = [
    {
      to: `/session/${sessionId}/chart`,
      label: "Bieu Do",
      icon: BarChart2,
      exact: false,
    },
    {
      to: `/session/${sessionId}/settings`,
      label: "Cau Hinh",
      icon: Settings,
      exact: false,
    },
  ];

  const centerTab = {
    to: `/session/${sessionId}/match`,
    label: "Van Dau",
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
        className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors relative ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Icon
          className={`size-5 transition-transform ${active ? "-translate-y-0.5" : ""}`}
        />
        <span className="text-xs font-medium">{tab.label}</span>
        {/* {active && (
          <div className="absolute bottom-0 w-10 h-0.5 rounded-full bg-primary" />
        )} */}
      </Link>
    );
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between px-4 h-14">
            <Link
              to="/"
              className="flex items-center gap-2 text-lg font-bold text-primary"
            >
              <Spade className="size-5" />
              Thirteen Game
            </Link>
            <ModeToggle />
          </div>
        </header>

        <Outlet />

        {/* Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
          <div className="flex items-center h-16 max-w-lg mx-auto px-2">
            {/* Left tabs */}
            {leftTabs.map((tab) => (
              <TabItem key={tab.to} tab={tab} />
            ))}

            {/* Center FAB */}
            <div className="flex flex-col items-center justify-center flex-shrink-0 px-3 -mt-5">
              <Link
                to={centerTab.to}
                className={`flex items-center justify-center size-14 rounded-full shadow-lg transition-all active:scale-95 ${
                  isCenterActive
                    ? "bg-primary text-primary-foreground shadow-primary/40 shadow-xl"
                    : "bg-primary text-primary-foreground shadow-primary/30"
                }`}
              >
                <Swords className="size-6" />
              </Link>
              <span
                className={`text-xs font-medium mt-1 ${
                  isCenterActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {centerTab.label}
              </span>
            </div>

            {/* Right tabs */}
            {rightTabs.map((tab) => (
              <TabItem key={tab.to} tab={tab} />
            ))}
          </div>
        </nav>
      </div>
    </ThemeProvider>
  );
}
