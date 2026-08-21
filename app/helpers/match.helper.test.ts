import { describe, expect, it } from "vitest";
import {
  buildPigCounts,
  computedScoresHelper,
  reRanking,
} from "~/helpers/match.helper";
import type {
  ChatHeo,
  GameConfigs,
  NhotBai,
} from "~/types/match.type";

// ── Fixtures ───────────────────────────────────────────────
const P = (id: string) => ({ id, name: id.toUpperCase(), orderNo: 0, initialScore: 0 });

const players = [P("p1"), P("p2"), P("p3"), P("p4")];

const baseConfig: GameConfigs = {
  rankPoints: [3, 1, -1, -3],
  khapPoints: 3,
  sanhPoints: 5,
  maxKhapAccumulate: 5,
  maxSanhAccumulate: 3,
  heoDoPoints: 3,
  heodenPoints: 5,
  nhotBystanderPenalty: 2,
};

const noBonus = {
  gameConfig: baseConfig,
  activeNhot: null as NhotBai | null,
  nhotCount: 0,
  nhotterId: null,
  nhotVictimIds: [] as string[],
  nhotOthers: [] as string[],
  khapWinner: null as string | null,
  khapCount: 0,
  sanhWinner: null as string | null,
  chatHeoList: [] as ChatHeo[],
  accumulated: { khap: 1, sanh: 1 },
  denBaiLosses: {},
};

function calc(overrides: Partial<Parameters<typeof computedScoresHelper>[0]>) {
  return computedScoresHelper({
    players: players as any,
    ranking: ["p1", "p2", "p3", "p4"],
    ...noBonus,
    ...overrides,
  } as any);
}

// ── Tests ──────────────────────────────────────────────────
describe("computedScoresHelper", () => {
  it("tính điểm hạng cơ bản (không có thưởng/phạt)", () => {
    expect(calc({})).toEqual({ p1: 3, p2: 1, p3: -1, p4: -3 });
  });

  it("cộng điểm khạp cho người thắng, trừ cho 3 người còn lại", () => {
    // gain = 1 * 2 * 3 * 3 = 18 ; loss mỗi người = 1 * 2 * 3 = 6
    expect(
      calc({ khapWinner: "p1", khapCount: 2 }),
    ).toEqual({ p1: 21, p2: -5, p3: -7, p4: -9 });
  });

  it("cộng điểm sảnh cho người thắng, trừ cho 3 người còn lại", () => {
    // gain = 1 * 1 * 5 * 3 = 15 ; loss mỗi người = 1 * 1 * 5 = 5
    expect(
      calc({ sanhWinner: "p2" }),
    ).toEqual({ p1: -2, p2: 16, p3: -6, p4: -8 });
  });

  it("chặt heo: người chặt cộng, người bị chặt trừ", () => {
    const chatHeoList: ChatHeo[] = [
      {
        id: "c1",
        chatterId: "p1",
        chatterName: "P1",
        victimId: "p4",
        victimName: "P4",
        heo: { do: 1, den: 0 }, // 1 * 3 = 3
      },
    ];
    expect(calc({ chatHeoList })).toEqual({ p1: 6, p2: 1, p3: -1, p4: -6 });
  });

  it("nhốt 1: nhốt thắng rankPoints[0]*2 + heo, bị nhốt thua tương ứng", () => {
    const activeNhot: NhotBai = {
      id: "n1",
      nhotterId: "p1",
      victims: [{ victimId: "p4", heo: { do: 0, den: 1 } }], // heo đen = 5
      denForIds: [],
    };
    // nhotter gain = 3*2 + 5 = 11 ; victim -11 ; p2->rank1, p3->rank2
    expect(
      calc({
        activeNhot,
        nhotCount: 1,
        nhotterId: "p1",
        nhotVictimIds: ["p4"],
        nhotOthers: ["p2", "p3"],
      }),
    ).toEqual({ p1: 11, p2: 1, p3: -1, p4: -11 });
  });

  it("nhốt 2 (không đền): nhốt thắng tổng, 2 bị nhốt thua, người ngoài phạt", () => {
    const activeNhot: NhotBai = {
      id: "n2",
      nhotterId: "p1",
      victims: [
        { victimId: "p2", heo: { do: 0, den: 0 } },
        { victimId: "p3", heo: { do: 0, den: 0 } },
      ],
      denForIds: [],
    };
    // ecPts = 6 ; gain = 6+6 = 12 ; + nhotBystanderPenalty(2) = 14
    // p2=-6, p3=-6, p4 (người ngoài) -= 2 => -2
    expect(
      calc({
        activeNhot,
        nhotCount: 2,
        nhotterId: "p1",
        nhotVictimIds: ["p2", "p3"],
        nhotOthers: ["p4"],
      }),
    ).toEqual({ p1: 14, p2: -6, p3: -6, p4: -2 });
  });

  it("nhốt 2 có đền bài: người đền chịu toàn bộ, người được đền hoàn lại", () => {
    const activeNhot: NhotBai = {
      id: "n3",
      nhotterId: "p1",
      victims: [
        { victimId: "p2", heo: { do: 0, den: 0 } },
        { victimId: "p3", heo: { do: 0, den: 0 } },
      ],
      dennerId: "p3",
      denForIds: ["p2"],
    };
    const denBaiLosses = { p2: 6, p3: 6 };
    // p2: -6 (victim) +6 (được đền) = 0
    // p3: -6 (victim) -6 (đền) = -12
    // p1: 14, p4: -2
    expect(
      calc({
        activeNhot,
        nhotCount: 2,
        nhotterId: "p1",
        nhotVictimIds: ["p2", "p3"],
        nhotOthers: ["p4"],
        denBaiLosses,
      }),
    ).toEqual({ p1: 14, p2: 0, p3: -12, p4: -2 });
  });
});

describe("reRanking", () => {
  it("gán hạng thấp nhất cho 2 người bị nhốt (nhốt 2)", () => {
    const ranking = ["p1", "p2", "p3", "p4"];
    const activeNhot: NhotBai = {
      id: "n",
      nhotterId: "p1",
      victims: [
        { victimId: "p2", heo: { do: 0, den: 0 } },
        { victimId: "p3", heo: { do: 0, den: 0 } },
      ],
      denForIds: [],
    };
    const map = reRanking(ranking, activeNhot);
    expect(map.get("p1")).toBe(1);
    expect(map.get("p4")).toBe(4);
    expect(map.get("p2")).toBe(4);
    expect(map.get("p3")).toBe(4);
  });
});

describe("buildPigCounts", () => {
  it("cộng heo cho người chặt, trừ cho người bị chặt", () => {
    const chatHeoList: ChatHeo[] = [
      {
        id: "c",
        chatterId: "p1",
        chatterName: "P1",
        victimId: "p2",
        victimName: "P2",
        heo: { do: 2, den: 1 },
      },
    ];
    const counts = buildPigCounts(["p1", "p2"], chatHeoList, null);
    expect(counts["p1"]).toEqual({ red: 2, black: 1 });
    expect(counts["p2"]).toEqual({ red: -2, black: -1 });
  });
});
