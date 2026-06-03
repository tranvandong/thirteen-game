"use client";

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
import {
  Copy,
  Check,
  Trophy,
  UserPlus,
  Plus,
  Crown,
  X,
  ArrowBigUpDash,
  ArrowBigDownDash,
  Minus,
} from "lucide-react";

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
    { id: "req-2", displayName: "Nguoi Moi 2", status: "pending" },
  ],
  totals: [
    { playerId: "p1", totalScore: 50 },
    { playerId: "p2", totalScore: 20 },
    { playerId: "p3", totalScore: -10 },
    { playerId: "p4", totalScore: -60 },
  ],
  // Previous round ranking to compute rank changes (index = previous rank 0-based)
  previousRanking: ["p2", "p1", "p3", "p4"], // p2 was 1st, p1 was 2nd before last round
};

// export async function loader({ params }: Route.LoaderArgs) { ... }

export default function SessionLobby() {
  const { sessionId } = useParams();
  const [copied, setCopied] = useState(false);
  const [showRoomCode, setShowRoomCode] = useState(true);
  const [showJoinRequests, setShowJoinRequests] = useState(true);
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
      pendingRequests: prev.pendingRequests.filter(
        (r) => r.id !== joinRequestId,
      ),
    }));
  };

  const handleReject = (joinRequestId: string) => {
    setState((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter(
        (r) => r.id !== joinRequestId,
      ),
    }));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(sessionLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sort players by score for ranking display
  const sortedPlayers = [...mockData.playerList].sort((a, b) => {
    const scoreA =
      state.totals.find((t) => t.playerId === a.id)?.totalScore || 0;
    const scoreB =
      state.totals.find((t) => t.playerId === b.id)?.totalScore || 0;
    return scoreB - scoreA;
  });

  // Compute rank change: compare current rank vs previous rank
  const getRankChange = (
    playerId: string,
    currentIndex: number,
  ): "up" | "down" | "same" => {
    const prevIndex = mockData.previousRanking.indexOf(playerId);
    if (prevIndex === -1) return "same";
    if (currentIndex < prevIndex) return "up";
    if (currentIndex > prevIndex) return "down";
    return "same";
  };

  const getRankStyle = (score: number) => {
    return score >= 0
      ? "bg-chart-2/20 text-chart-2 border-chart-2/30"
      : "bg-destructive/10 text-destructive border-destructive/30";
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="size-4 text-chart-4" />;
    return null;
  };

  const RankChangeIndicator = ({
    change,
  }: {
    change: "up" | "down" | "same";
  }) => {
    if (change === "up")
      return (
        <span className="flex items-center text-chart-2">
          <ArrowBigUpDash className="size-4" fill="currentColor" />
        </span>
      );
    if (change === "down")
      return (
        <span className="flex items-center text-destructive">
          <ArrowBigDownDash className="size-4" fill="currentColor" />
        </span>
      );
    return (
      <span className="flex items-center text-muted-foreground opacity-40">
        <Minus className="size-3" />
      </span>
    );
  };

  const hasNewRequests = state.pendingRequests.length > 0;

  return (
    <main className="p-4 flex flex-col gap-4">
      {/* Join Requests — hiển thị ở trên cùng khi có yêu cầu, có thể đóng */}
      {isOwner && hasNewRequests && showJoinRequests && (
        <Card className="border-chart-4/40 bg-chart-4/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-8 rounded-full bg-chart-4/20 text-chart-4">
                  <UserPlus className="size-4" />
                </div>
                <span className="text-base">
                  Yeu Cau Tham Gia{" "}
                  <span className="inline-flex items-center justify-center size-5 rounded-full bg-chart-4 text-background text-xs font-bold ml-1">
                    {state.pendingRequests.length}
                  </span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => setShowJoinRequests(false)}
              >
                <X className="size-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            {state.pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg bg-chart-4/10 border border-chart-4/20"
              >
                <span className="font-medium text-sm">
                  {request.displayName}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleApprove(request.id)}
                    className="bg-chart-2 hover:bg-chart-2/90 h-7 text-xs px-3"
                  >
                    Duyet
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(request.id)}
                    className="h-7 text-xs px-3"
                  >
                    Tu choi
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Room Code — compact, collapsible */}
      {showRoomCode && (
        <Card>
          <CardContent className="py-2 px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                  Ma Phong
                </span>
                <span className="text-xl font-bold text-primary tracking-wider">
                  {mockData.session.code}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyLink}
                  className="gap-1.5 h-8 text-xs px-2"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-chart-2" />
                      <span className="hidden sm:inline">Da sao chep</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span className="hidden sm:inline">Sao chep link</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowRoomCode(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            const rankChange = getRankChange(player.id, index);

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${getRankStyle(score)}`}
              >
                <div className="flex items-center gap-3">
                  {index === 0 ? (
                    <span className="flex items-center justify-center size-6">
                      <Crown className="size-4 text-chart-4" />
                    </span>
                  ) : (
                    <span className="flex items-center justify-center size-6 rounded-full bg-background text-xs font-bold">
                      {index + 1}
                    </span>
                  )}
                  <span className="font-medium">{player.name}</span>
                  <RankChangeIndicator change={rankChange} />
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

      {/* Add Round Button - Fixed at bottom above tab bar */}
      {/* {isOwner && (
        <div className="fixed bottom-20 right-4 z-40">
          <Button size="lg" className="rounded-full size-14 shadow-lg">
            <Plus className="size-6" />
            <span className="sr-only">Them van dau</span>
          </Button>
        </div>
      )} */}
    </main>
  );
}
