import { useState, useEffect } from "react";
import { useParams } from "react-router";
import type { Route } from "./+types/index";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { participants } from "~/db/schema/participants";
import { players } from "~/db/schema/players";
import { joinRequests } from "~/db/schema/join-requests";
import { sessionTotals } from "~/db/schema/session-totals";
import { eq } from "drizzle-orm";
import {
  joinSession,
  onParticipantJoined,
  approveJoinRequest,
  rejectJoinRequest,
  onScoreUpdated,
} from "~/services/socket.client";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId as any),
  });

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  const playerList = await db.query.players.findMany({
    where: eq(players.sessionId, sessionId as any),
    orderBy: players.orderNo,
  });

  const participantList = await db.query.participants.findMany({
    where: eq(participants.sessionId, sessionId as any),
  });

  const pendingRequests = await db.query.joinRequests.findMany({
    where: eq(joinRequests.sessionId, sessionId as any),
  });

  const totals = await db.query.sessionTotals.findMany({
    where: eq(sessionTotals.sessionId, sessionId as any),
  });

  return {
    session,
    playerList,
    participantList,
    pendingRequests: pendingRequests.filter((r) => r.status === "pending"),
    totals,
  };
}

export default function SessionLobby({ loaderData }: Route.ComponentProps) {
  const { sessionId } = useParams();
  const [state, setState] = useState({
    participantList: loaderData.participantList,
    totals: loaderData.totals,
    pendingRequests: loaderData.pendingRequests,
  });

  const [copied, setCopied] = useState(false);
  const sessionLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/session/${sessionId}`
      : "";

  useEffect(() => {
    if (sessionId) {
      const participantId = localStorage.getItem(`participant-${sessionId}`);
      if (participantId) {
        joinSession(sessionId, participantId, "User");
      }

      onParticipantJoined(({ displayName }: any) => {
        console.log(`${displayName} joined`);
      });

      onScoreUpdated(({ totalScores }: any) => {
        setState((prev) => ({ ...prev, totals: totalScores }));
      });
    }
  }, [sessionId]);

  const isOwner = loaderData.participantList.some(
    (p: any) => p.id === loaderData.session.ownerParticipantId
  );

  const handleApprove = (joinRequestId: string) => {
    if (sessionId && isOwner) {
      approveJoinRequest(sessionId, joinRequestId, "displayName");
    }
  };

  const handleReject = (joinRequestId: string) => {
    if (sessionId && isOwner) {
      rejectJoinRequest(sessionId, joinRequestId);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(sessionLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Phòng Chơi</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Mã Phòng</p>
              <p className="text-2xl font-bold text-blue-600">
                {loaderData.session.code}
              </p>
            </div>
            <div>
              <button
                onClick={copyLink}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition"
              >
                {copied ? "✓ Đã sao chép" : "Sao chép Link Mời"}
              </button>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Người Tham Gia ({state.participantList.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {state.participantList.map((participant: any) => (
              <div key={participant.id} className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="font-semibold text-gray-800">{participant.displayName}</p>
                <p className="text-sm text-gray-600">
                  {participant.role === "owner" ? "Chủ phòng" : "Người chơi"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Players Scores */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Bảng Điểm</h2>
          <div className="space-y-2">
            {loaderData.playerList.map((player: any) => {
              const total = state.totals.find(
                (t: any) => t.playerId === player.id
              );
              return (
                <div
                  key={player.id}
                  className="flex justify-between items-center bg-gray-50 p-4 rounded-lg"
                >
                  <span className="font-semibold text-gray-800">{player.name}</span>
                  <span
                    className={`text-lg font-bold ${(total?.totalScore || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {total?.totalScore || 0}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Join Requests */}
        {isOwner && state.pendingRequests.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Yêu Cầu Tham Gia ({state.pendingRequests.length})
            </h2>
            <div className="space-y-3">
              {state.pendingRequests.map((request: any) => (
                <div
                  key={request.id}
                  className="flex justify-between items-center bg-yellow-50 p-4 rounded-lg"
                >
                  <span className="font-semibold text-gray-800">
                    {request.displayName} muốn tham gia
                  </span>
                  <div className="space-x-2">
                    <button
                      onClick={() => handleApprove(request.id)}
                      className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-4 rounded transition"
                    >
                      Duyệt
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-4 rounded transition"
                    >
                      Từ Chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-4 flex-wrap">
          <button className="flex-1 min-w-max bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition">
            Bảng Điểm Chi Tiết
          </button>
          <button className="flex-1 min-w-max bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition">
            Lịch Sử Ván Đấu
          </button>
          {isOwner && (
            <button className="flex-1 min-w-max bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition">
              Thêm Kết Quả Ván
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
