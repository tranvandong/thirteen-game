import { Outlet, Link, useParams, useLocation } from "react-router";
// import type { Route } from "./+types/layout";
// import { db } from "~/db/client.server";
// import { sessions } from "~/db/schema/sessions";
// import { eq } from "drizzle-orm";
import { ModeToggle } from "~/components/mode-toggle";
import { ThemeProvider } from "~/components/theme-provider";
import { Home, Clock, Settings, Spade, BarChart2, Swords } from "lucide-react";

// export async function loader({ params }: Route.LoaderArgs) {
//   const { sessionId } = params;
//   const session = await db.query.sessions.findFirst({
//     where: eq(sessions.id, sessionId as any),
//   });
//   if (!session) {
//     throw new Response("Session not found", { status: 404 });
//   }
//   return { session };
// }

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
