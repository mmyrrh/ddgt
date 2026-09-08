"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  cost_points: number;
  is_active: boolean;
};

export default function RewardsAdminPage() {
  const router = useRouter();

  const [familyId, setFamilyId] = useState("");

  const [emoji, setEmoji] = useState("🎁");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [costPoints, setCostPoints] = useState("");

  const [rewards, setRewards] = useState<Reward[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: family, error: familyError } = await supabase
        .from("families")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .single();

      if (familyError || !family) {
        router.replace("/setup");
        return;
      }

      setFamilyId(family.id);

      await loadRewards(family.id);

      setLoading(false);
    }

    init();
  }, [router]);

  async function loadRewards(targetFamilyId: string) {
    const { data, error } = await supabase
      .from("rewards")
      .select(
        "id, title, description, emoji, cost_points, is_active"
      )
      .eq("family_id", targetFamilyId)
      .order("cost_points")
      .order("created_at");

    if (error) {
      setMessage(error.message);
      return;
    }

    setRewards(data ?? []);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!familyId) return;

    const numericPoints = Number(costPoints);

    if (!title.trim()) {
      setMessage("상품 이름을 입력해주세요.");
      return;
    }

    if (
      !Number.isInteger(numericPoints) ||
      numericPoints <= 0
    ) {
      setMessage("필요 포인트는 1 이상의 숫자로 입력해주세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("rewards").insert({
      family_id: familyId,
      title: title.trim(),
      description: description.trim() || null,
      emoji: emoji.trim() || "🎁",
      cost_points: numericPoints,
      is_active: true,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setEmoji("🎁");
    setTitle("");
    setDescription("");
    setCostPoints("");

    setMessage("상점 상품을 등록했습니다. ✅");

    await loadRewards(familyId);

    setSaving(false);
  }

  async function deleteReward(id: string) {
    const ok = window.confirm(
      "이 상품을 삭제할까요?"
    );

    if (!ok) return;

    const { error } = await supabase
      .from("rewards")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadRewards(familyId);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          상점 불러오는 중...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F2F2] text-[#252525]">
      <div className="mx-auto min-h-screen max-w-md bg-[#F7F7F7]">
        <header className="flex h-16 items-center bg-[#FFD84D] px-5">
          <button
            onClick={() => router.push("/admin")}
            className="mr-4 text-xl"
          >
            ←
          </button>

          <h1 className="text-xl font-bold">
            포인트 상점 관리
          </h1>
        </header>

        <section className="p-5">
          <div className="mb-6">
            <p className="text-sm text-[#777]">
              아빠 관리
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              보상 상품 만들기 🎁
            </h2>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold">
                이모지
              </label>

              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🎁"
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold">
                상품 이름
              </label>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 아이스크림"
                required
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold">
                설명
              </label>

              <input
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="예: 원하는 아이스크림 1개"
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-bold">
                필요 포인트
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={costPoints}
                onChange={(e) =>
                  setCostPoints(e.target.value)
                }
                placeholder="예: 50"
                required
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
            >
              {saving
                ? "등록 중..."
                : "상점에 상품 추가"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">
                등록된 상품
              </h3>

              <span className="text-sm text-[#777]">
                {rewards.length}개
              </span>
            </div>

            {rewards.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-[#888]">
                아직 등록된 상품이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {rewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center">
                      <span className="mr-4 text-3xl">
                        {reward.emoji || "🎁"}
                      </span>

                      <div>
                        <p className="font-bold">
                          {reward.title}
                        </p>

                        {reward.description && (
                          <p className="mt-1 text-sm text-[#777]">
                            {reward.description}
                          </p>
                        )}

                        <p className="mt-1 text-sm font-bold">
                          ⭐ {reward.cost_points}P
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        deleteReward(reward.id)
                      }
                      className="rounded-lg bg-[#F3F3F3] px-3 py-2 text-sm"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}