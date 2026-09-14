// app/routes/api.tts.ts
import type { Route } from "./+types/api.tts";
import { env } from "~/lib/env.server";

export async function action({ request }: Route.ActionArgs) {
  const { text } = await request.json();
  const response = await fetch(
    `${env.TTS_API_URL}/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_v3",
        language_code: "vi",
      }),
    }
  );

  if (!response.ok) {
   
    throw new Response(await response.text(), {
      status: response.status,
    });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}