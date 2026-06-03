"use client";

import { useState } from "react";
import type { Route } from "./+types/session.create";
// import { db } from "~/db/client.server";
// import { sessions } from "~/db/schema/sessions";
// import { gameConfigs } from "~/db/schema/game-configs";
// import { players as playerSchema } from "~/db/schema/players";
// import { participants } from "~/db/schema/participants";
// import { redirect } from "react-router";
// import { eq } from "drizzle-orm";
import { Link, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ChevronDown, ChevronLeft, Users, Trophy, Settings, Play } from "lucide-react";

// export async function action({ request }: Route.ActionArgs) {
//   if (request.method !== "POST") {
//     return { error: "Method not allowed" };
//   }

//   const formData = await request.formData();
//   const playerNames = [
//     formData.get("player1") as string,
//     formData.get("player2") as string,
//     formData.get("player3") as string,
//     formData.get("player4") as string,
//   ];

//   const gameConfig = {
//     firstPlaceScore: parseInt(formData.get("firstPlaceScore") as string),
//     secondPlaceScore: parseInt(formData.get("secondPlaceScore") as string),
//     thirdPlaceScore: parseInt(formData.get("thirdPlaceScore") as string),
//     fourthPlaceScore: parseInt(formData.get("fourthPlaceScore") as string),
//     redPigScore: parseInt(formData.get("redPigScore") as string),
//     blackPigScore: parseInt(formData.get("blackPigScore") as string),
//     tripleScore: parseInt(formData.get("tripleScore") as string),
//     khapScore: parseInt(formData.get("khapScore") as string),
//     khapLimit: parseInt(formData.get("khapLimit") as string),
//     sanhScore: parseInt(formData.get("sanhScore") as string),
//     sanhLimit: parseInt(formData.get("sanhLimit") as string),
//   };

//   try {
//     const session = await db
//       .insert(sessions)
//       .values({
//         code: Math.random().toString(36).substring(2, 8).toUpperCase(),
//         status: "waiting",
//       })
//       .returning();

//     const sessionId = session[0].id;

//     await db.insert(gameConfigs).values({
//       sessionId,
//       ...gameConfig,
//     });

//     for (let i = 0; i < playerNames.length; i++) {
//       await db.insert(playerSchema).values({
//         sessionId,
//         name: playerNames[i],
//         orderNo: i + 1,
//       });
//     }

//     const ownerParticipant = await db
//       .insert(participants)
//       .values({
//         sessionId,
//         displayName: formData.get("ownerName") as string,
//         role: "owner",
//       })
//       .returning();

//     await db
//       .update(sessions)
//       .set({ ownerParticipantId: ownerParticipant[0].id })
//       .where(eq(sessions.id, sessionId));

//     return redirect(`/session/${sessionId}`);
//   } catch (error) {
//     console.error("Error creating session:", error);
//     return { error: "Failed to create session" };
//   }
// }

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tao phong choi - Thirteen Game" }];
}

export default function CreateSession() {
  const navigate = useNavigate();
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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = "Vui long nhap ten chu phong";
    }

    for (let i = 1; i <= 4; i++) {
      const playerName = formData[`player${i}` as keyof typeof formData] as string;
      if (!playerName.trim()) {
        newErrors[`player${i}`] = `Vui long nhap ten nguoi choi ${i}`;
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
    e.preventDefault();
    if (validateForm()) {
      // TODO: Submit form data to server
      console.log("Form data:", formData);
      // Navigate to session page with mock sessionId
      navigate("/session/demo-session");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/" className="flex items-center justify-center">
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Tao Phong Choi</h1>
        </div>
      </header>

      <main className="pb-24">
        <form id="create-form" onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          {/* Owner Name Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
                  <Users className="size-4" />
                </div>
                Chu Phong
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ownerName">Ten cua ban</Label>
                <Input
                  id="ownerName"
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={(e) => {
                    setFormData({ ...formData, ownerName: e.target.value });
                    if (errors.ownerName) {
                      setErrors({ ...errors, ownerName: "" });
                    }
                  }}
                  placeholder="Nhap ten cua ban"
                  aria-invalid={!!errors.ownerName}
                />
                {errors.ownerName && (
                  <p className="text-destructive text-sm">{errors.ownerName}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Players Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="flex items-center justify-center size-8 rounded-full bg-chart-2/20 text-chart-2">
                  <Users className="size-4" />
                </div>
                Nguoi Choi
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Label htmlFor={`player${i + 1}`}>Nguoi choi {i + 1}</Label>
                  <Input
                    id={`player${i + 1}`}
                    type="text"
                    name={`player${i + 1}`}
                    value={formData[`player${i + 1}` as keyof typeof formData] as string}
                    onChange={(e) => handlePlayerNameChange(i, e.target.value)}
                    placeholder={`Ten nguoi choi ${i + 1}`}
                    aria-invalid={!!errors[`player${i + 1}`]}
                  />
                  {errors[`player${i + 1}`] && (
                    <p className="text-destructive text-sm">{errors[`player${i + 1}`]}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Rank Scores Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="flex items-center justify-center size-8 rounded-full bg-chart-4/20 text-chart-4">
                  <Trophy className="size-4" />
                </div>
                Diem Hang
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="firstPlaceScore">Hang Nhat</Label>
                  <Input
                    id="firstPlaceScore"
                    type="number"
                    name="firstPlaceScore"
                    value={formData.firstPlaceScore}
                    onChange={(e) => handleFirstPlaceChange(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="secondPlaceScore">Hang Nhi</Label>
                  <Input
                    id="secondPlaceScore"
                    type="number"
                    name="secondPlaceScore"
                    value={formData.secondPlaceScore}
                    onChange={(e) => handleSecondPlaceChange(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="thirdPlaceScore">Hang Ba</Label>
                  <Input
                    id="thirdPlaceScore"
                    type="number"
                    name="thirdPlaceScore"
                    value={formData.thirdPlaceScore}
                    onChange={(e) => setFormData({ ...formData, thirdPlaceScore: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fourthPlaceScore">Hang Tu</Label>
                  <Input
                    id="fourthPlaceScore"
                    type="number"
                    name="fourthPlaceScore"
                    value={formData.fourthPlaceScore}
                    onChange={(e) => setFormData({ ...formData, fourthPlaceScore: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings Collapsible */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer active:bg-muted/50 transition-colors rounded-t-xl">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground">
                        <Settings className="size-4" />
                      </div>
                      Cai Dat Nang Cao
                    </span>
                    <ChevronDown
                      className={`size-5 text-muted-foreground transition-transform duration-200 ${
                        isAdvancedOpen ? "rotate-180" : ""
                      }`}
                    />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="flex flex-col gap-4 pt-0">
                  {/* Pig Scores */}
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Diem Heo</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="redPigScore">Heo Do</Label>
                        <Input
                          id="redPigScore"
                          type="number"
                          name="redPigScore"
                          value={formData.redPigScore}
                          onChange={(e) => setFormData({ ...formData, redPigScore: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="blackPigScore">Heo Den</Label>
                        <Input
                          id="blackPigScore"
                          type="number"
                          name="blackPigScore"
                          value={formData.blackPigScore}
                          onChange={(e) => setFormData({ ...formData, blackPigScore: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Triple Score */}
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-muted-foreground">3 Doi Thong</p>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="tripleScore">Diem</Label>
                      <Input
                        id="tripleScore"
                        type="number"
                        name="tripleScore"
                        value={formData.tripleScore}
                        onChange={(e) => setFormData({ ...formData, tripleScore: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  {/* Khap Score */}
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Diem Khap</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="khapScore">Diem/Khap</Label>
                        <Input
                          id="khapScore"
                          type="number"
                          name="khapScore"
                          value={formData.khapScore}
                          onChange={(e) => setFormData({ ...formData, khapScore: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="khapLimit">Gioi han</Label>
                        <Input
                          id="khapLimit"
                          type="number"
                          name="khapLimit"
                          value={formData.khapLimit}
                          onChange={(e) => setFormData({ ...formData, khapLimit: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sanh Score */}
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Diem Sanh</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="sanhScore">Diem/Sanh</Label>
                        <Input
                          id="sanhScore"
                          type="number"
                          name="sanhScore"
                          value={formData.sanhScore}
                          onChange={(e) => setFormData({ ...formData, sanhScore: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="sanhLimit">Gioi han</Label>
                        <Input
                          id="sanhLimit"
                          type="number"
                          name="sanhLimit"
                          value={formData.sanhLimit}
                          onChange={(e) => setFormData({ ...formData, sanhLimit: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </form>
      </main>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4">
        <div className="flex gap-3">
          <Button
            type="submit"
            form="create-form"
            className="flex-1"
            size="lg"
          >
            <Play className="size-4" />
            Bat Dau Choi
          </Button>
        </div>
      </div>
    </div>
  );
}
