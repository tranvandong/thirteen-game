"use client";

import { useState } from "react";
import type { Route } from "./+types/session.create";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { gameConfigs } from "~/db/schema/game-configs";
import { players as playerSchema } from "~/db/schema/players";
import { participants } from "~/db/schema/participants";
import { redirect } from "react-router";
import { eq } from "drizzle-orm";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return { error: "Method not allowed" };
  }

  const formData = await request.formData();
  const playerNames = [
    formData.get("player1") as string,
    formData.get("player2") as string,
    formData.get("player3") as string,
    formData.get("player4") as string,
  ];

  const gameConfig = {
    firstPlaceScore: parseInt(formData.get("firstPlaceScore") as string),
    secondPlaceScore: parseInt(formData.get("secondPlaceScore") as string),
    thirdPlaceScore: parseInt(formData.get("thirdPlaceScore") as string),
    fourthPlaceScore: parseInt(formData.get("fourthPlaceScore") as string),
    redPigScore: parseInt(formData.get("redPigScore") as string),
    blackPigScore: parseInt(formData.get("blackPigScore") as string),
    tripleScore: parseInt(formData.get("tripleScore") as string),
    khapScore: parseInt(formData.get("khapScore") as string),
    khapLimit: parseInt(formData.get("khapLimit") as string),
    sanhScore: parseInt(formData.get("sanhScore") as string),
    sanhLimit: parseInt(formData.get("sanhLimit") as string),
  };

  try {
    const session = await db
      .insert(sessions)
      .values({
        code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        status: "waiting",
      })
      .returning();

    const sessionId = session[0].id;

    await db.insert(gameConfigs).values({
      sessionId,
      ...gameConfig,
    });

    for (let i = 0; i < playerNames.length; i++) {
      await db.insert(playerSchema).values({
        sessionId,
        name: playerNames[i],
        orderNo: i + 1,
      });
    }

    const ownerParticipant = await db
      .insert(participants)
      .values({
        sessionId,
        displayName: formData.get("ownerName") as string,
        role: "owner",
      })
      .returning();

    await db
      .update(sessions)
      .set({ ownerParticipantId: ownerParticipant[0].id })
      .where(eq(sessions.id, sessionId));

    return redirect(`/session/${sessionId}`);
  } catch (error) {
    console.error("Error creating session:", error);
    return { error: "Failed to create session" };
  }
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tạo phòng chơi - Thirteen Game" }];
}

export default function CreateSession() {
  const [formData, setFormData] = useState({
    ownerName: "",
    player1: "",
    player2: "",
    player3: "",
    player4: "",
    firstPlaceScore: 20,
    secondPlaceScore: 10,
    thirdPlaceScore: 0,
    fourthPlaceScore: -30,
    redPigScore: 20,
    blackPigScore: 10,
    tripleScore: 20,
    khapScore: 1,
    khapLimit: 3,
    sanhScore: 1,
    sanhLimit: 2,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = "Vui lòng nhập tên chủ phòng";
    }

    for (let i = 1; i <= 4; i++) {
      const playerName = formData[`player${i}` as keyof typeof formData] as string;
      if (!playerName.trim()) {
        newErrors[`player${i}`] = `Vui lòng nhập tên người chơi ${i}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlayerNameChange = (index: number, value: string) => {
    const key = `player${index + 1}` as keyof typeof formData;
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    if (errors[`player${index + 1}`]) {
      setErrors((prev) => ({
        ...prev,
        [`player${index + 1}`]: "",
      }));
    }
  };

  const handleFirstPlaceChange = (value: number) => {
    setFormData((prev) => ({
      ...prev,
      firstPlaceScore: value,
      fourthPlaceScore: prev.fourthPlaceScore === -prev.firstPlaceScore ? -value : prev.fourthPlaceScore,
      redPigScore: prev.redPigScore === prev.firstPlaceScore ? value : prev.redPigScore,
      tripleScore: prev.tripleScore === prev.firstPlaceScore ? value : prev.tripleScore,
    }));
  };

  const handleSecondPlaceChange = (value: number) => {
    setFormData((prev) => ({
      ...prev,
      secondPlaceScore: value,
      thirdPlaceScore: prev.thirdPlaceScore === prev.secondPlaceScore ? value : prev.thirdPlaceScore,
      blackPigScore: prev.blackPigScore === prev.secondPlaceScore ? value : prev.blackPigScore,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!validateForm()) {
      e.preventDefault();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Tạo Phòng Chơi</h1>
          <p className="text-gray-600 mb-8">Cấu hình luật chơi và danh sách người chơi</p>

          <form method="POST" className="space-y-8" onSubmit={handleSubmit}>
            {/* Owner Name */}
            <div className="bg-blue-50 p-6 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tên Chủ Phòng
              </label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={(e) => {
                  setFormData({ ...formData, ownerName: e.target.value });
                  if (errors.ownerName) {
                    setErrors({ ...errors, ownerName: "" });
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.ownerName ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                }`}
                placeholder="Nhập tên của bạn"
              />
              {errors.ownerName && <p className="text-red-500 text-sm mt-1">{errors.ownerName}</p>}
            </div>

            {/* Player Names */}
            <div className="bg-green-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Danh Sách Người Chơi</h2>
              <div className="grid grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Người chơi {i + 1}
                    </label>
                    <input
                      type="text"
                      name={`player${i + 1}`}
                      value={formData[`player${i + 1}` as keyof typeof formData] as string}
                      onChange={(e) => handlePlayerNameChange(i, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        errors[`player${i + 1}`] ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"
                      }`}
                      placeholder={`Tên người chơi ${i + 1}`}
                    />
                    {errors[`player${i + 1}`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`player${i + 1}`]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rank Scores */}
            <div className="bg-purple-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Điểm Hạng</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hạng Nhất</label>
                  <input
                    type="number"
                    name="firstPlaceScore"
                    value={formData.firstPlaceScore}
                    onChange={(e) => handleFirstPlaceChange(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hạng Tư</label>
                  <input
                    type="number"
                    name="fourthPlaceScore"
                    value={formData.fourthPlaceScore}
                    onChange={(e) => setFormData({ ...formData, fourthPlaceScore: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hạng Nhì</label>
                  <input
                    type="number"
                    name="secondPlaceScore"
                    value={formData.secondPlaceScore}
                    onChange={(e) => handleSecondPlaceChange(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hạng Ba</label>
                  <input
                    type="number"
                    name="thirdPlaceScore"
                    value={formData.thirdPlaceScore}
                    onChange={(e) => setFormData({ ...formData, thirdPlaceScore: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Pig Scores */}
            <div className="bg-orange-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Điểm Heo</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Heo Đỏ</label>
                  <input
                    type="number"
                    name="redPigScore"
                    value={formData.redPigScore}
                    onChange={(e) => setFormData({ ...formData, redPigScore: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Heo Đen</label>
                  <input
                    type="number"
                    name="blackPigScore"
                    value={formData.blackPigScore}
                    onChange={(e) => setFormData({ ...formData, blackPigScore: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Triple Score */}
            <div className="bg-pink-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Điểm 3 Đôi Thông</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Điểm 3 Đôi Thông</label>
                <input
                  type="number"
                  name="tripleScore"
                  value={formData.tripleScore}
                  onChange={(e) => setFormData({ ...formData, tripleScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            {/* Khap Score */}
            <div className="bg-yellow-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Điểm Khạp</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Điểm Mỗi Khạp</label>
                  <input
                    type="number"
                    name="khapScore"
                    value={formData.khapScore}
                    onChange={(e) => setFormData({ ...formData, khapScore: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Giới Hạn Khạp</label>
                  <input
                    type="number"
                    name="khapLimit"
                    value={formData.khapLimit}
                    onChange={(e) => setFormData({ ...formData, khapLimit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>
            </div>

            {/* Sanh Score */}
            <div className="bg-cyan-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Điểm Sảnh</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Điểm Mỗi Sảnh</label>
                  <input
                    type="number"
                    name="sanhScore"
                    value={formData.sanhScore}
                    onChange={(e) => setFormData({ ...formData, sanhScore: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Giới Hạn Sảnh</label>
                  <input
                    type="number"
                    name="sanhLimit"
                    value={formData.sanhLimit}
                    onChange={(e) => setFormData({ ...formData, sanhLimit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
              >
                Bắt Đầu Chơi
              </button>
              <a
                href="/"
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg text-center transition duration-200"
              >
                Quay Lại
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
