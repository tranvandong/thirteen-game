import { useFetcher, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/settings";
import { db } from "~/db/client.server";
import { participants } from "~/db/schema/participants";
import { joinRequests } from "~/db/schema/join-requests";
import { participantPlayers } from "~/db/schema/participant-players";
import { and, eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import {
  Users,
  UserPlus,
  Settings,
  Gamepad2,
  RotateCcw,
  CheckCircle2,
  Pencil,
  Shield,
  LogOut,
} from "lucide-react";
import { SessionQRCode } from "~/components/session-qr-code";
import {
  useSession,
  usePlayers,
  useCurrentParticipant,
  useGameConfig,
  useSessionStore,
} from "~/stores/useSessionStore";
import { playerDevices, players, sessions } from "~/db/schema";
import { useEffect, useState } from "react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "~/components/ui/field";
import { IMAGE_NAMES } from "~/components/background";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

// ---------------------------------------------------------------------------
// Loader — chỉ fetch những gì store không có
// ---------------------------------------------------------------------------
export async function loader({ params }: Route.LoaderArgs) {
  const sessionCode = params.sessionId;
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!session) throw new Response("Session not found", { status: 404 });

  const [participantList, selections, pendingRequests, playerList] =
    await Promise.all([
      db.query.participants.findMany({
        where: eq(participants.sessionId, session.id),
      }),

      db.query.participantPlayers.findMany({
        where: eq(participantPlayers.sessionId, session.id),
      }),

      db.query.joinRequests.findMany({
        where: and(
          eq(joinRequests.sessionId, session.id),
          eq(joinRequests.status, "pending"),
        ),
      }),
      db.select().from(players).where(eq(players.sessionId, session.id)),
    ]);

  const participantsWithPlayer = participantList.map((p) => ({
    ...p,
    selectedPlayerId:
      selections.find((s) => s.participantId === p.id)?.playerId ?? null,
  }));

  return { participantsWithPlayer, pendingRequests, playerList };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------
export async function action({ request, params }: Route.ActionArgs) {
  const sessionCode = params.sessionId;
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "select-player") {
    const participantId = form.get("participantId") as string;
    const playerId = form.get("playerId") as string;

    await db
      .insert(participantPlayers)
      .values({ sessionId: session.id, participantId, playerId })
      .onConflictDoNothing();

    return { ok: true };
  }

  if (intent === "reset-player") {
    const participantId = form.get("participantId") as string;

    await db
      .delete(participantPlayers)
      .where(
        and(
          eq(participantPlayers.sessionId, session.id),
          eq(participantPlayers.participantId, participantId),
        ),
      );

    return { ok: true };
  }

  if (intent === "approve-request") {
    const joinRequestId = form.get("joinRequestId") as string;
    const approvedBy = form.get("approvedBy") as string;

    await db
      .update(joinRequests)
      .set({ status: "approved", approvedBy, approvedAt: new Date() })
      .where(eq(joinRequests.id, joinRequestId));

    return { ok: true };
  }

  if (intent === "reject-request") {
    const joinRequestId = form.get("joinRequestId") as string;

    await db
      .update(joinRequests)
      .set({ status: "rejected" })
      .where(eq(joinRequests.id, joinRequestId));

    return { ok: true };
  }

  if (intent === "update-players") {
    const updates = JSON.parse(form.get("updates") as string) as Array<{
      id: string;
      name: string;
      initialScore: number;
    }>;

    await Promise.all(
      updates.map((u) =>
        db
          .update(players)
          .set({ name: u.name, initialScore: u.initialScore })
          .where(eq(players.id, u.id)),
      ),
    );

    return { ok: true };
  }

  if (intent === "finish-session") {
    const fingerprint = form.get("fingerprint") as string;
    if (!fingerprint) {
      return { error: "not found device" };
    }
    const [playerDevice] = await db
      .select({ participantId: playerDevices.participantId })
      .from(playerDevices)
      .where(
        and(
          eq(playerDevices.sessionId, session.id),
          eq(playerDevices.fingerprint, fingerprint),
        ),
      );
    if (!playerDevice) {
      return { error: "not found device in session" };
    }
    const [participant] = await db
      .select({ role: participants.role })
      .from(participants)
      .where(eq(participants.id, playerDevice.participantId));

    if (!participant) {
      return { error: "not found participant" };
    }
    if (participant.role !== "owner") {
      return { error: "not owner" };
    }
    await db
      .update(sessions)
      .set({ status: "finished", updatedAt: new Date() })
      .where(eq(sessions.id, session.id));

    return { ok: true, finished: true };
  }

  return { ok: false };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { participantsWithPlayer, pendingRequests, playerList } =
    useLoaderData<typeof loader>();

  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const [editDrafts, setEditDrafts] = useState<
    Record<string, { name: string; initialScore: string }>
  >({});

  const session = useSession();
  const gameConfig = useGameConfig();
  const { updateConfig } = useSessionStore();
  const players = usePlayers();
  const currentParticipant = useCurrentParticipant();
  const [visible, setVisible] = useState(false);

  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      if (fetcher.data.finished) {
        navigate("/");
        return;
      }
      setIsEditing(false);
      setShowFinishConfirm(false);
    }
  }, [fetcher.state, fetcher.data, navigate]);

  const isOwner =
    !!session &&
    !!currentParticipant &&
    currentParticipant.id === session.ownerParticipantId;

  const mySelectedPlayerId =
    participantsWithPlayer.find((p) => p.id === currentParticipant?.id)
      ?.selectedPlayerId ?? null;

  const takenPlayerIds = new Set(
    participantsWithPlayer
      .filter((p) => p.id !== currentParticipant?.id && p.selectedPlayerId)
      .map((p) => p.selectedPlayerId as string),
  );

  const isBusy = fetcher.state !== "idle";
  const isFinishing =
    isBusy && (fetcher.formData?.get("intent") as string) === "finish-session";

  const handleSelectPlayer = (playerId: string) => {
    if (mySelectedPlayerId || !currentParticipant) return;
    fetcher.submit(
      {
        intent: "select-player",
        participantId: currentParticipant.id,
        playerId,
      },
      { method: "POST" },
    );
  };

  const handleResetPlayer = (participantId: string) => {
    fetcher.submit(
      { intent: "reset-player", participantId },
      { method: "POST" },
    );
  };

  const handleApprove = (joinRequestId: string) => {
    fetcher.submit(
      {
        intent: "approve-request",
        joinRequestId,
        approvedBy: currentParticipant?.id ?? "",
      },
      { method: "POST" },
    );
  };

  const handleReject = (joinRequestId: string) => {
    fetcher.submit(
      { intent: "reject-request", joinRequestId },
      { method: "POST" },
    );
  };

  const startEdit = () => {
    const drafts: Record<string, { name: string; initialScore: string }> = {};
    playerList.forEach((p) => {
      drafts[p.id] = {
        name: p.name,
        initialScore: String(p.initialScore ?? 0),
      };
    });
    setEditDrafts(drafts);
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = () => {
    const updates = players.map((p) => ({
      id: p.id,
      name: editDrafts[p.id]?.name ?? p.name,
      initialScore: parseInt(editDrafts[p.id]?.initialScore ?? "0", 10) || 0,
    }));
    fetcher.submit(
      { intent: "update-players", updates: JSON.stringify(updates) },
      { method: "POST" },
    );
  };

  const handleFinishSession = () => {
    const fingerprint = localStorage.getItem("device_fingerprint");
    console.log("fingerprint", fingerprint);
    fetcher.submit(
      { intent: "finish-session", fingerprint },
      { method: "POST" },
    );
  };

  const toggleBackground = (value: boolean) => {
    localStorage.setItem("showBackground", value.toString());
    updateConfig({ showBackground: value });
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

      {/* ------------------------------------------------------------------ */}
      {/* Chọn nhân vật                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
                <Gamepad2 className="size-4" />
              </div>
              Chọn nhân vật
            </div>

            {isOwner &&
              (isEditing ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-3 relative z-10"
                    onClick={cancelEdit}
                    disabled={isBusy}
                  >
                    Hủy
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs px-3 relative z-10"
                    onClick={saveEdit}
                    disabled={isBusy}
                  >
                    Lưu
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-3 gap-1 relative z-10"
                  onClick={startEdit}
                >
                  <Pencil className="size-3" />
                  Chỉnh sửa
                </Button>
              ))}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex flex-1 gap-2">
                  <div className="flex-1 min-w-0 rounded-md text-sm">
                    Tên nhân vật
                  </div>
                  <div className="w-20 shrink-0 rounded-md text-sm text-right">
                    Giáp
                  </div>
                </div>
              </div>
              {players.map((player) => {
                const draft = editDrafts[player.id] ?? {
                  name: player.name,
                  initialScore: String(player.initialScore ?? 0),
                };
                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-2 p-3 rounded-lg bg-muted"
                  >
                    <div className="flex flex-1 gap-2">
                      <input
                        type="text"
                        value={draft.name}
                        maxLength={100}
                        placeholder="Tên nhân vật"
                        onChange={(e) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [player.id]: {
                              ...prev[player.id],
                              name: e.target.value,
                            },
                          }))
                        }
                        className="relative z-10 flex-1 min-w-0 rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <input
                        type="number"
                        value={draft.initialScore}
                        placeholder="Điểm"
                        onChange={(e) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [player.id]: {
                              ...prev[player.id],
                              initialScore: e.target.value,
                            },
                          }))
                        }
                        className="relative z-10 w-20 shrink-0 rounded-md border bg-background px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground text-center">
                Sửa tên và điểm ban đầu cho từng nhân vật.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {playerList.map((player) => {
                  const isSelectedByMe = mySelectedPlayerId === player.id;
                  const isTaken = takenPlayerIds.has(player.id);
                  const takenBy = isTaken
                    ? participantsWithPlayer.find(
                        (p) => p.selectedPlayerId === player.id,
                      )
                    : null;

                  return (
                    <button
                      key={player.id}
                      disabled={!!mySelectedPlayerId || isTaken || isBusy}
                      onClick={() => handleSelectPlayer(player.id)}
                      className={[
                        "relative flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-colors",
                        isSelectedByMe
                          ? "bg-primary/10 border-primary text-primary"
                          : isTaken
                            ? "bg-muted/40 border-transparent text-muted-foreground cursor-not-allowed opacity-60"
                            : mySelectedPlayerId
                              ? "bg-muted/40 border-transparent text-muted-foreground cursor-not-allowed"
                              : "bg-muted border-transparent hover:border-primary/40 hover:bg-primary/5 cursor-pointer",
                      ].join(" ")}
                    >
                      {isSelectedByMe && (
                        <CheckCircle2 className="absolute top-2 right-2 size-4 text-primary" />
                      )}
                      <div
                        className={[
                          "flex items-center justify-center size-10 rounded-full text-base font-bold",
                          isSelectedByMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-foreground",
                        ].join(" ")}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{player.name}</span>
                      {(player.initialScore ?? 0) !== 0 && (
                        <div className="relative inline-flex items-center justify-center">
                          <Shield className="size-8 text-muted-foreground" />
                          <span className="absolute text-[9px] font-bold text-muted-foreground leading-none">
                            {player.initialScore}
                          </span>
                        </div>
                      )}
                      {isTaken && takenBy && (
                        <span className="text-xs text-muted-foreground">
                          ← {takenBy.displayName}
                        </span>
                      )}
                      {isSelectedByMe && (
                        <span className="text-xs text-primary font-normal">
                          Bạn đang chọn
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!mySelectedPlayerId && (
                <p className="text-xs text-muted-foreground text-center">
                  Chọn nhân vật của bạn. Mỗi người chỉ chọn được một lần.
                </p>
              )}
              {mySelectedPlayerId && !isOwner && (
                <p className="text-xs text-muted-foreground text-center">
                  Bạn đã chọn xong. Chỉ chủ phòng mới có thể đặt lại.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Người tham gia                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
            Người tham gia ({participantsWithPlayer.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {participantsWithPlayer.map((participant) => {
              const selectedPlayer = participant.selectedPlayerId
                ? players.find((p) => p.id === participant.selectedPlayerId)
                : null;

              return (
                <div
                  key={participant.id}
                  className={[
                    "flex items-center justify-between p-3 rounded-lg",
                    participant.role === "owner"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center justify-center size-9 rounded-full bg-background shrink-0">
                      <Users className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {participant.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {participant.role === "owner"
                          ? "Chủ phòng"
                          : "Người chơi"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedPlayer ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                        <CheckCircle2 className="size-3" />
                        {selectedPlayer.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Chưa chọn
                      </span>
                    )}

                    {isOwner && selectedPlayer && (
                      <button
                        onClick={() => handleResetPlayer(participant.id)}
                        disabled={isBusy}
                        title="Đặt lại lựa chọn"
                        className="flex items-center justify-center size-7 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Yêu cầu tham gia (chỉ chủ phòng)                                   */}
      {/* ------------------------------------------------------------------ */}
      {isOwner && pendingRequests.length > 0 && (
        <Card className="border-chart-4/40 bg-chart-4/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-full bg-chart-4/20 text-chart-4">
                <UserPlus className="size-4" />
              </div>
              <span>
                Yêu cầu tham gia{" "}
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-chart-4 text-background text-xs font-bold ml-1">
                  {pendingRequests.length}
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendingRequests.map((request) => (
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
                    disabled={isBusy}
                    onClick={() => handleApprove(request.id)}
                    className="bg-chart-2 hover:bg-chart-2/90 h-7 text-xs px-3"
                  >
                    Duyệt
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isBusy}
                    onClick={() => handleReject(request.id)}
                    className="h-7 text-xs px-3"
                  >
                    Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <FieldLabel htmlFor="switch-share">
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Cho phép hiển thị hình nền</FieldTitle>
            <FieldDescription>
              Hình nền hiển thị và tự động thay đổi sau một thời gian.
              <Button
                variant="ghost"
                onClick={() => setVisible(true)}
                className="relative z-10"
              >
                Xem trước
              </Button>
            </FieldDescription>
          </FieldContent>
          <Switch
            id="switch-enable-background"
            checked={gameConfig?.showBackground}
            onCheckedChange={toggleBackground}
            className="relative z-10"
          />
        </Field>
      </FieldLabel>

      {/* ------------------------------------------------------------------ */}
      {/* Kết thúc phiên (chỉ chủ phòng)                                     */}
      {/* ------------------------------------------------------------------ */}
      {isOwner && (
        <div className="mt-2 mb-4">
          {!showFinishConfirm ? (
            <button
              onClick={() => setShowFinishConfirm(true)}
              disabled={isBusy}
              className="relative z-10 w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-destructive/40 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors disabled:opacity-50"
            >
              <LogOut className="size-4" />
              Kết thúc phiên chơi
            </button>
          ) : (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-destructive text-center">
                Kết thúc phiên chơi?
              </p>
              <p className="text-xs text-muted-foreground text-center leading-5">
                Toàn bộ người chơi sẽ bị đưa về trang chủ. Hành động này không
                thể hoàn tác.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFinishConfirm(false)}
                  disabled={isBusy}
                  className="relative z-10 flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleFinishSession}
                  disabled={isBusy}
                  className="relative z-10 flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isFinishing ? (
                    <div className="size-4 rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  Xác nhận kết thúc
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Lightbox
        open={visible}
        close={() => setVisible(false)}
        slides={IMAGE_NAMES.map((name) => ({
          src: `/images/${name}.jpg`,
          imageFit: "cover",
        }))}
        styles={{ slide: { padding: 0 } }}
        plugins={[Zoom]}
        animation={{ zoom: 500 }}
        zoom={{
          maxZoomPixelRatio: 2,
          zoomInMultiplier: 4,
          doubleTapDelay: 300,
          doubleClickDelay: 300,
          doubleClickMaxStops: 2,
          keyboardMoveDistance: 50,
          wheelZoomDistanceFactor: 100,
          pinchZoomDistanceFactor: 100,
          scrollToZoom: true,

        }}
        toolbar={{
          buttons: ["close"],
        }}
      />
    </main>
  );
}
