import type { Route } from "./+types/stream";
import {env} from "./../../../lib/env.server"

export async function action({ request }: Route.ActionArgs) {
  const payload = await request.json();

  const response = await fetch(`${env.AI_API_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${response.status}` }),
      { status: response.status, headers: { "Content-Type": "application/json" } },
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return new Response("Empty response", { status: 502 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
