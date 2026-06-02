import { Outlet, Link, useParams, useLocation } from "react-router";
// import type { Route } from "./+types/layout";
// import { db } from "~/db/client.server";
// import { sessions } from "~/db/schema/sessions";
// import { eq } from "drizzle-orm";
import { ModeToggle } from "~/components/mode-toggle";
import { ThemeProvider } from "~/components/theme-provider";
import { Home, Clock, Settings } from "lucide-react";

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

  const tabs = [
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
    {
      to: `/session/${sessionId}/score-board`,
      label: "Cau Hinh",
      icon: Settings,
      exact: false,
    },
  ];

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between px-4 h-14">
            <Link to="/" className="text-lg font-bold text-primary">
              Thirteen Game
            </Link>
            <ModeToggle />
          </div>
        </header>

        <Outlet />

        {/* Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
          <div className="flex items-stretch h-16 max-w-lg mx-auto">
            {tabs.map((tab) => {
              const isActive = tab.exact
                ? location.pathname === tab.to
                : location.pathname.startsWith(tab.to);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors relative ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon
                    className={`size-5 transition-transform ${
                      isActive ? "-translate-y-0.5" : ""
                    }`}
                  />
                  <span className="text-xs font-medium">{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 w-10 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </ThemeProvider>
  );
}
