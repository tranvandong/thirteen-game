import { InstallPWA } from "~/components/install-pwa";
import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Plus, Users, Spade } from "lucide-react";

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
        <div className="flex flex-col items-center justify-center gap-12 mb-4">
          <img
            src="/icons/icon-72x72.png"
            alt="logo"
            className="w-24 h-24 rounded-full"
          />
          <h1 className="text-5xl font-bold text-white">Thirteen Game</h1>
        </div>
        <p className="text-xl text-white mb-8">
          Ghi diem Tien Len theo thoi gian thuc
        </p>

        <div className="space-y-4 max-w-md mx-auto">
          <Link
            to="/session/create"
            className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-100 text-blue-600 font-bold py-4 px-6 rounded-lg transition duration-200 text-lg"
          >
            <Plus className="size-5" />
            Tao Phong Choi Moi
          </Link>

          <div className="text-white text-center py-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Users className="size-5" />
              <p>Hoac nhap ma phong de tham gia</p>
            </div>
            <input
              type="text"
              placeholder="Nhap ma phong"
              className="w-full px-4 py-2 rounded-lg mb-3 text-center focus:outline-none"
            />
            <button className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-100 text-blue-600 font-bold py-2 px-6 rounded-lg transition duration-200">
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
