import { InstallPWA } from "~/components/install-pwa";
import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Thirteen Game - Ghi Điểm Tiến Lên" },
    {
      name: "description",
      content: "Ứng dụng ghi điểm Tiến Lên theo thời gian thực",
    },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-4">Thirteen Game</h1>
        <p className="text-xl text-white mb-8">
          Ghi điểm Tiến Lên theo thời gian thực
        </p>

        <div className="space-y-4 max-w-md mx-auto">
          <Link
            to="/session/create"
            className="block w-full bg-white hover:bg-gray-100 text-blue-600 font-bold py-4 px-6 rounded-lg transition duration-200 text-lg"
          >
            Tạo Phòng Chơi Mới
          </Link>

          <div className="text-white text-center py-4">
            <p className="mb-4">Hoặc nhập mã phòng để tham gia</p>
            <input
              type="text"
              placeholder="Nhập mã phòng"
              className="w-full px-4 py-2 rounded-lg mb-3 text-center focus:outline-none"
            />
            <button className="w-full bg-white hover:bg-gray-100 text-blue-600 font-bold py-2 px-6 rounded-lg transition duration-200">
              Tham Gia
            </button>
          </div>
          <InstallPWA />
        </div>
      </div>
    </div>
  );
}
