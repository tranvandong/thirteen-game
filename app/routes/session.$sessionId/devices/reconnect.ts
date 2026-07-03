import { db } from "~/db/client.server";
import { playerDevices } from "~/db/schema/player-devices";
import { sessions } from "~/db/schema/sessions";
import { eq, and } from "drizzle-orm";
import type { Route } from "./+types/reconnect";

export async function action({ params, request }: Route.ActionArgs) {
  console.log("origin", request.headers.get("origin"));
  console.log("host", request.headers.get("host"));
  console.log(
    "x-forwarded-host",
    request.headers.get("x-forwarded-host")
  );
  const { sessionId: sessionCode } = params;
   console.log('rawText');
  const rawText = await request.text();
  console.log(rawText);
  let body: { fingerprint: string };
  try {
    body = JSON.parse(rawText);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body?.fingerprint)
    return Response.json({ error: "No fingerprint" }, { status: 400 });

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!session)
    return Response.json({ error: "Session not found" }, { status: 404 });

  // Thực hiện transaction: tìm thiết bị và kích hoạt lại
  const updated = await db.transaction(async (tx) => {
    // 1. Tìm xem thiết bị này đã từng join session này chưa
    const [existingDevice] = await tx
      .select()
      .from(playerDevices)
      .where(
        and(
          eq(playerDevices.sessionId, session.id),
          eq(playerDevices.fingerprint, body?.fingerprint),
        ),
      )
      .limit(1);

    if (!existingDevice) return null;

    // 2. Nếu đã từng join (dù đang 'active' hay 'left'), kích hoạt lại
    await tx
      .update(playerDevices)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(playerDevices.id, existingDevice.id));

    return true;
  });

  if (updated) {
    return Response.json({ success: true });
  }

  return Response.json({ error: "Device not found" }, { status: 404 });
}
