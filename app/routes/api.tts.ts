// app/routes/api.tts.ts
import type { Route } from "./+types/api.tts";
import "dotenv"

export async function action({ request }: Route.ActionArgs) {
    console.log("process.env.ELEVENLABS_API_KEY", process.env.ELEVENLABS_API_KEY)
  const { text } = await request.json();
  const response = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128",
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
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