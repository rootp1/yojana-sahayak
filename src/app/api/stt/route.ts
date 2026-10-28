/**
 * Server-side speech-to-text, used when the browser has no built-in speech
 * recognition (e.g. Firefox, some iPhones). Uses Sarvam AI's Indic STT, which
 * handles Hindi, English and Hinglish code-mixing.
 */
export const maxDuration = 30;

export async function GET() {
  return Response.json({ enabled: Boolean(process.env.SARVAM_API_KEY) });
}

export async function POST(req: Request) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return Response.json({ error: "speech-to-text not configured" }, { status: 501 });

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "missing audio" }, { status: 400 });
  }
  if (audio.size > 4 * 1024 * 1024) {
    return Response.json({ error: "audio too long" }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, "speech.webm");
  upstream.append("model", process.env.SARVAM_STT_MODEL ?? "saarika:v2.5");
  upstream.append("language_code", "unknown"); // auto-detect Hindi / English / other Indian languages

  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: upstream,
  });
  if (!res.ok) {
    console.error("sarvam stt failed", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "transcription failed" }, { status: 502 });
  }
  const data = (await res.json()) as { transcript?: string; language_code?: string };
  return Response.json({ text: data.transcript ?? "", language: data.language_code ?? null });
}
