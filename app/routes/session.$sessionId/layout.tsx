import { Outlet, Link, useParams, useLocation } from "react-router";
import type { Route } from "./+types/layout";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { eq } from "drizzle-orm";
import { ModeToggle } from "~/components/mode-toggle";
import { ThemeProvider } from "~/components/theme-provider";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId as any),
  });

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  return { session };
}

export default function SessionLayout() {
  const { sessionId } = useParams();
  const location = useLocation();

  const tabs = [
    {
      to: `/session/${sessionId}`,
      label: "Phòng",
      icon: (active: boolean) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      exact: true,
    },
    {
      to: `/session/${sessionId}/history`,
      label: "Lịch Sử",
      icon: (active: boolean) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      exact: false,
    },
    {
      to: `/session/${sessionId}/score-board`,
      label: "Cấu Hình",
      icon: (active: boolean) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      ),
      exact: false,
    },
  ];

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
        {/* Header */}
        <div className="bg-white shadow-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold text-blue-600">
              Thirteen Game
            </Link>
            <ModeToggle />
          </div>
        </div>

        <Outlet />

        {/* Bottom Tab Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
          <div className="flex items-stretch h-16 max-w-lg mx-auto">
            {tabs.map((tab) => {
              const isActive = tab.exact
                ? location.pathname === tab.to
                : location.pathname.startsWith(tab.to);

              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors"
                  style={{ color: isActive ? "#2563eb" : "#9ca3af" }}
                >
                  <div
                    className="transition-transform"
                    style={{
                      transform: isActive ? "translateY(-2px)" : "none",
                    }}
                  >
                    {tab.icon(isActive)}
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={{ color: isActive ? "#2563eb" : "#9ca3af" }}
                  >
                    {tab.label}
                  </span>
                  {isActive && (
                    <div
                      className="absolute bottom-0 w-10 h-0.5 rounded-full bg-blue-600"
                      style={{ width: "2.5rem" }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
