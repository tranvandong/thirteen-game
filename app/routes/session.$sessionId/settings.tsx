"use client";

import { useState } from "react";
import { useParams } from "react-router";
// import type { Route } from "./+types/settings";
// import { db } from "~/db/client.server";
// import { sessions } from "~/db/schema/sessions";
// import { participants } from "~/db/schema/participants";
// import { players } from "~/db/schema/players";
// import { joinRequests } from "~/db/schema/join-requests";
// import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Copy, Check, Users, UserPlus, Settings } from "lucide-react";
import { SessionQRCode } from "~/components/session-qr-code";

// Mock data for UI development
const mockData = {
  session: {
    id: "demo-session",
    code: "ABC123",
    status: "waiting",
    ownerParticipantId: "owner-1",
  },
  participantList: [
    { id: "owner-1", displayName: "Chu Phong", role: "owner" },
    { id: "part-2", displayName: "Khach 1", role: "player" },
    { id: "part-3", displayName: "Khach 2", role: "player" },
  ],
  pendingRequests: [
    { id: "req-1", displayName: "Nguoi Moi", status: "pending" },
    { id: "req-2", displayName: "Nguoi Moi 2", status: "pending" },
  ],
};

// export async function loader({ params }: Route.LoaderArgs) { ... }

export default function SettingsPage() {
  const { sessionId } = useParams();
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState({
    participantList: mockData.participantList,
    pendingRequests: mockData.pendingRequests,
  });

  const sessionLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/session/${sessionId}`
      : "";

  const isOwner = true;

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

  return (
    <main className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
          <Settings className="size-4" />
        </div>
        <h1 className="text-lg font-semibold">Cấu hình</h1>
      </div>

     
          <SessionQRCode />
       

      {/* Join Requests */}
      {isOwner && state.pendingRequests.length > 0 && (
        <Card className="border-chart-4/40 bg-chart-4/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-full bg-chart-4/20 text-chart-4">
                <UserPlus className="size-4" />
              </div>
              <span>
                Yeu Cau Tham Gia{" "}
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-chart-4 text-background text-xs font-bold ml-1">
                  {state.pendingRequests.length}
                </span>
              </span>
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
                  <span className="font-medium text-sm">
                    {request.displayName}
                  </span>
                </div>
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
                <p className="font-medium text-sm text-center">
                  {participant.displayName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {participant.role === "owner" ? "Chu phong" : "Nguoi choi"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
