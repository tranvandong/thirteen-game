export const createFingerprint = async () => {
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? "",
  ].join("|");
  const msgBuffer = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const fingerprint = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 64);
  return fingerprint;
};

export async function getOrCreateFingerprint(): Promise<string> {
  const STORAGE_KEY = "device_fingerprint";
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const fingerprint = await createFingerprint();
  localStorage.setItem(STORAGE_KEY, fingerprint);
  return fingerprint;
}
