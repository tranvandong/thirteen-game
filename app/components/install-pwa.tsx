import { useState } from "react";
import { usePWA } from "~/hooks/usePWA";

export function InstallPWA() {
  const {
    canInstall,
    promptInstall,
    isInstalled,
    showManualInstallHint,
    isIOSSafari,
  } = usePWA();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  //   if (isInstalled) return null;

  return (
    <button
      onClick={promptInstall}
      className="w-full hover:text-blue-600 text-white  py-2 px-6 rounded-lg transition duration-200"
    >
      Cài đặt ứng dụng
    </button>
  );

  if (isIOSSafari) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="w-full bg-white hover:bg-gray-100 text-blue-600 font-bold py-2 px-6 rounded-lg transition duration-200"
        >
          Cài đặt ứng dụng
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
            <div className="bg-white rounded-t-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                Cài đặt trên iPhone
              </h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center font-medium shrink-0">
                    1
                  </span>
                  <span>
                    Nhấn nút <strong>Chia sẻ</strong>{" "}
                    <span className="inline-block border border-gray-300 rounded px-1">
                      ⬆
                    </span>{" "}
                    ở thanh dưới Safari
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center font-medium shrink-0">
                    2
                  </span>
                  <span>
                    Cuộn xuống và chọn{" "}
                    <strong>"Thêm vào Màn hình chính"</strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center font-medium shrink-0">
                    3
                  </span>
                  <span>
                    Nhấn <strong>"Thêm"</strong> ở góc trên bên phải
                  </span>
                </li>
              </ol>

              {/* Visual hint arrow chỉ xuống */}
              <div className="mt-4 text-center text-gray-400 text-xs">
                ↓ Nút chia sẻ nằm ở thanh dưới cùng của Safari
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full py-3 bg-gray-100 rounded-xl text-sm font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (canInstall) {
    return (
      <button
        onClick={promptInstall}
        className="w-full bg-white hover:bg-gray-100 text-blue-600 font-bold py-2 px-6 rounded-lg transition duration-200"
      >
        Cài đặt ứng dụng
      </button>
    );
  }

  if (showManualInstallHint) {
    return (
      <div className="text-sm text-blue-700">
        Nhấn ⊕ trên thanh địa chỉ để cài đặt
      </div>
    );
  }

  return null;
}
