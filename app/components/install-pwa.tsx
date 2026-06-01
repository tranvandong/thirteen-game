import { usePWA } from "~/hooks/usePWA";

export function InstallPWA() {
  const { canInstall, promptInstall } = usePWA();
console.log(canInstall);
  if (!canInstall) return null;

  return (
    <button
      onClick={promptInstall}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-md hover:bg-blue-700 transition"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v13M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
      </svg>
      Cài đặt ứng dụng
    </button>
  );
}