import { useState } from "react";
import { createPortal } from "react-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { InstallPWA } from "~/components/install-pwa";
import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import { Plus, Users, ScanLine, X } from "lucide-react";
import { Input } from "~/components/ui/input";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Thirteen Game - Ghi Điểm Tiến Lên" },
    {
      name: "description",
      content: "Ứng dụng ghi điểm Tiến Lên theo thời gian thực",
    },
  ];
}

// ── QR Scanner Modal ──────────────────────────────────────────

function QRScannerModal({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (results: Array<{ rawValue: string }>) => {
    if (!results.length) return;
    const raw = results[0].rawValue;
    // Parse URL dạng /join/ABCD-EFGH hoặc raw code
    const match = raw.match(/\/join\/([A-Z0-9]{4}-[A-Z0-9]{4})/i);
    const code = match ? match[1].toUpperCase() : raw.trim().toUpperCase();
    onDetected(code);
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 backdrop-blur-sm">
        <span className="text-white font-semibold text-sm">
          Quét mã QR phòng chơi
        </span>
        <button
          onClick={onClose}
          className="flex items-center justify-center size-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scanner */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="size-16 rounded-full bg-white/10 flex items-center justify-center">
              <ScanLine className="size-8 text-white/50" />
            </div>
            <p className="text-white/80 text-sm">{error}</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
            >
              Đóng
            </button>
          </div>
        ) : (
          <div className="w-full h-full">
            <Scanner
              onScan={handleScan}
              onError={(err) => {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.toLowerCase().includes("permission")) {
                  setError("Vui lòng cấp quyền camera để quét mã QR.");
                } else {
                  setError("Không thể mở camera. Hãy nhập mã phòng thủ công.");
                }
              }}
              constraints={{ facingMode: "environment" }}
              components={{
                // Dùng viewfinder mặc định của thư viện
                tracker: undefined,
              }}
              styles={{
                container: {
                  width: "100%",
                  height: "100%",
                  position: "relative",
                },
                video: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                },
              }}
            />
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="px-6 py-4 bg-black/70 backdrop-blur-sm text-center">
        <p className="text-white/60 text-xs">
          Đưa mã QR vào khung hình để tự động nhận diện
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Home Page ─────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [codeError, setCodeError] = useState("");

  const handleJoin = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setCodeError("Vui lòng nhập mã phòng");
      return;
    }
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      setCodeError("Mã phòng không hợp lệ (dạng XXXX-XXXX)");
      return;
    }
    navigate(`/join/${code}`);
  };

  const handleQRDetected = (code: string) => {
    setShowScanner(false);
    navigate(`/join/${code}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center px-4">
      {showScanner && (
        <QRScannerModal
          onClose={() => setShowScanner(false)}
          onDetected={handleQRDetected}
        />
      )}

      <div className="text-center w-full max-w-md">
        {/* Logo & Title */}
        <div className="flex flex-col items-center justify-center gap-6 mb-6">
          <img
            src="/icons/icon-72x72.png"
            alt="logo"
            className="w-24 h-24 rounded-full shadow-2xl"
          />
          <h1 className="text-5xl font-bold text-white drop-shadow-lg">
            Thirteen Game
          </h1>
        </div>
        <p className="text-xl text-white/90 mb-10">
          Ghi điểm Tiến Lên theo thời gian thực
        </p>

        <div className="space-y-4">
          {/* Tạo phòng */}
          <Link
            to="/session/create"
            className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-100 text-blue-600 font-bold py-4 px-6 rounded-xl transition duration-200 text-lg shadow-lg"
          >
            <Plus className="size-5" />
            Tạo Phòng Chơi Mới
          </Link>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-white/30" />
            <span className="text-white/70 text-sm font-medium">
              hoặc tham gia
            </span>
            <div className="flex-1 h-px bg-white/30" />
          </div>

          {/* Join section */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 space-y-3">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <Users className="size-4" />
              <span className="font-medium">Nhập mã phòng để tham gia</span>
            </div>

            {/* Input + QR button */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setCodeError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="XXXX-XXXX"
                  className={`
                    bg-white text-gray-800 font-mono font-bold text-center tracking-widest
                    border-0 h-11 text-base placeholder:font-normal placeholder:tracking-normal
                    ${codeError ? "ring-2 ring-red-400" : ""}
                  `}
                  maxLength={9}
                />
                {codeError && (
                  <p className="text-red-200 text-xs mt-1 text-left">
                    {codeError}
                  </p>
                )}
              </div>

              {/* QR Scan button */}
              <button
                onClick={() => setShowScanner(true)}
                className="
                  flex items-center justify-center size-11 rounded-lg shrink-0
                  bg-white/20 hover:bg-white/30 active:bg-white/40
                  border border-white/30 text-white
                  transition-all duration-150
                "
                title="Quét mã QR"
              >
                <ScanLine className="size-5" />
              </button>
            </div>

            <button
              onClick={handleJoin}
              className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-100 text-blue-600 font-bold py-2.5 px-6 rounded-lg transition duration-200"
            >
              <Users className="size-4" />
              Tham Gia
            </button>
          </div>

          <InstallPWA />
        </div>
      </div>
    </div>
  );
}
