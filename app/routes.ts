import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("session/create", "routes/session.create.tsx"),

  route("session/:sessionId", "routes/session.$sessionId/layout.tsx", [
    index("routes/session.$sessionId/index.tsx"),

    route("settings", "routes/session.$sessionId/settings.tsx"),

    route("history", "routes/session.$sessionId/history.tsx"),

    route("match", "routes/session.$sessionId/match.tsx"),

    route("chart", "routes/session.$sessionId/chart.tsx"),

    route("history/:roundId", "routes/session.$sessionId/round-detail.tsx"),

    route("devices", "routes/session.$sessionId/devices.ts"),
  ]),
  route("join/:sessionId", "routes/join/$sessionId.tsx"),
] satisfies RouteConfig;
