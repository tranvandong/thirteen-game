import { useState } from "react";
import { useParams } from "react-router";
// import type { Route } from "./+types/index";
// import { db } from "~/db/client.server";
// import { sessions } from "~/db/schema/sessions";
// import { participants } from "~/db/schema/participants";
// import { players } from "~/db/schema/players";
// import { joinRequests } from "~/db/schema/join-requests";
// import { sessionTotals } from "~/db/schema/session-totals";
// import { eq } from "drizzle-orm";
// import {
//   joinSession,
//   onParticipantJoined,
//   approveJoinRequest,
//   rejectJoinRequest,
//   onScoreUpdated,
// } from "~/services/socket.client";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Copy, Check, Users, Trophy, UserPlus, Plus, Crown } from "lucide-react";

// Mock data for UI development
const mockData = {
  session: {
    id: "demo-session",
    code: "ABC123",
    status: "waiting",
    ownerParticipantId: "owner-1",
  },
  playerList: [
    { id: "p1", name: "Nguoi Choi 1", orderNo: 1 },
    { id: "p2", name: "Nguoi Choi 2", orderNo: 2 },
    { id: "p3", name: "Nguoi Choi 3", orderNo: 3 },
    { id: "p4", name: "Nguoi Choi 4", orderNo: 4 },
  ],
  participantList: [
    { id: "owner-1", displayName: "Chu Phong", role: "owner" },
    { id: "part-2", displayName: "Khach 1", role: "player" },
  ],
  pendingRequests: [
    { id: "req-1", displayName: "Nguoi Moi", status: "pending" },
  ],
  totals: [
    { playerId: "p1", totalScore: 50 },
    { playerId: "p2", totalScore: 20 },
    { playerId: "p3", totalScore: -10 },
    { playerId: "p4", totalScore: -60 },
  ],
};

// export async function loader({ params }: Route.LoaderArgs) {
//   const { sessionId } = params;

//   const session = await db.query.sessions.findFirst({
//     where: eq(sessions.id, sessionId as any),
//   });

//   if (!session) {
//     throw new Response("Session not found", { status: 404 });
//   }

//   const playerList = await db.query.players.findMany({
//     where: eq(players.sessionId, sessionId as any),
//     orderBy: players.orderNo,
//   });

//   const participantList = await db.query.participants.findMany({
//     where: eq(participants.sessionId, sessionId as any),
//   });

//   const pendingRequests = await db.query.joinRequests.findMany({
//     where: eq(joinRequests.sessionId, sessionId as any),
//   });

//   const totals = await db.query.sessionTotals.findMany({
//     where: eq(sessionTotals.sessionId, sessionId as any),
//   });

//   return {
//     session,
//     playerList,
//     participantList,
//     pendingRequests: pendingRequests.filter((r) => r.status === "pending"),
//     totals,
//   };
// }

export default function SessionLobby() {
  const { sessionId } = useParams();
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState({
    participantList: mockData.participantList,
    totals: mockData.totals,
    pendingRequests: mockData.pendingRequests,
  });

  const sessionLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/session/${sessionId}`
      : "";

  const isOwner = true; // Mock: current user is owner

  const handleApprove = (joinRequestId: string) => {
    setState((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter((r) => r.id !== joinRequestId),
    }));
  };

  const handleReject = (joinRequestId: string) => {
    setState((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter((r) => r.id !== joinRequestId),
    }));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(sessionLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sort players by score for ranking display
  const sortedPlayers = [...mockData.playerList].sort((a, b) => {
    const scoreA = state.totals.find((t) => t.playerId === a.id)?.totalScore || 0;
    const scoreB = state.totals.find((t) => t.playerId === b.id)?.totalScore || 0;
    return scoreB - scoreA;
  });

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0:
        return "bg-chart-4/20 text-chart-4 border-chart-4/30";
      case 1:
        return "bg-muted text-muted-foreground border-muted";
      case 2:
        return "bg-chart-2/20 text-chart-2 border-chart-2/30";
      default:
        return "bg-destructive/10 text-destructive border-destructive/30";
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="size-4 text-chart-4" />;
    return null;
  };

  return (
    <main className="p-4 flex flex-col gap-4">
      {/* Room Code & Share */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="text-base font-medium text-muted-foreground">Ma Phong</span>
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-chart-2" />
                  Da sao chep
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Sao chep link
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary tracking-wider text-center">
            {mockData.session.code}
          </p>
        </CardContent>
      </Card>

      {/* Score Board */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-full bg-chart-4/20 text-chart-4">
              <Trophy className="size-4" />
            </div>
            Bang Diem
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sortedPlayers.map((player, index) => {
            const total = state.totals.find((t) => t.playerId === player.id);
            const score = total?.totalScore || 0;

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${getRankStyle(index)}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center size-6 rounded-full bg-background text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="font-medium">{player.name}</span>
                  {getRankIcon(index)}
                </div>
                <span
                  className={`text-lg font-bold ${
                    score >= 0 ? "text-chart-2" : "text-destructive"
                  }`}
                >
                  {score >= 0 ? `+${score}` : score}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
            Nguoi Tham Gia ({state.participantList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {state.participantList.map((participant) => (
              <div
                key={participant.id}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg ${
                  participant.role === "owner"
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted"
                }`}
              >
                <div className="flex items-center justify-center size-10 rounded-full bg-background">
                  <Users className="size-5 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm text-center">{participant.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {participant.role === "owner" ? "Chu phong" : "Nguoi choi"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Join Requests */}
      {isOwner && state.pendingRequests.length > 0 && (
        <Card className="border-chart-4/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-full bg-chart-4/20 text-chart-4">
                <UserPlus className="size-4" />
              </div>
              Yeu Cau Tham Gia ({state.pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {state.pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg bg-chart-4/10 border border-chart-4/20"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-8 rounded-full bg-background">
                    <Users className="size-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-sm">{request.displayName}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleApprove(request.id)}
                    className="bg-chart-2 hover:bg-chart-2/90"
                  >
                    Duyet
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(request.id)}
                  >
                    Tu choi
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add Round Button - Fixed at bottom above tab bar */}
      {isOwner && (
        <div className="fixed bottom-20 right-4 z-40">
          <Button size="lg" className="rounded-full size-14 shadow-lg">
            <Plus className="size-6" />
            <span className="sr-only">Them van dau</span>
          </Button>
        </div>
      )}
    </main>
  );
}
