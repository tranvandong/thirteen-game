import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("session/create", "routes/session.create.tsx"),

  route("session/:sessionId", "routes/session.$sessionId/layout.tsx", [
    index("routes/session.$sessionId/index.tsx"),

    route("score-board", "routes/session.$sessionId/score-board.tsx"),

    route("history", "routes/session.$sessionId/history.tsx"),

    route("history/:roundId", "routes/session.$sessionId/round-detail.tsx"),
  ]),
] satisfies RouteConfig;
