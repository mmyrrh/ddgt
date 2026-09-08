"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DAYS = [
  { weekday: 1, label: "월" },
  { weekday: 2, label: "화" },
  { weekday: 3, label: "수" },
  { weekday: 4, label: "목" },
  { weekday: 5, label: "금" },
  { weekday: 6, label: "토" },
  { weekday: 7, label: "일" },
];

export default function StudyDaysPage() {
  const router = useRouter();

  const [familyId, setFamilyId] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadStudyDays() {
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

      const { data: rows, error } = await supabase
        .from("study_days")
        .select("weekday, is_enabled")
        .eq("family_id", family.id)
        .order("weekday");

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const enabledDays =
        rows
          ?.filter((row) => row.is_enabled)
          .map((row) => row.weekday) ?? [];

      setSelectedDays(enabledDays);
      setLoading(false);
    }

    loadStudyDays();
  }, [router]);

  function toggleDay(weekday: number) {
    setSelectedDays((current) => {
      if (current.includes(weekday)) {
        return current.filter((day) => day !== weekday);
      }

      return [...current, weekday];
    });

    setMessage("");
  }

  async function saveStudyDays() {
    if (!familyId) return;

    if (selectedDays.length === 0) {
      setMessage("공부할 요일을 한 개 이상 선택해주세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const rows = DAYS.map((day) => ({
      family_id: familyId,
      weekday: day.weekday,
      is_enabled: selectedDays.includes(day.weekday),
    }));

    const { error } = await supabase
      .from("study_days")
      .upsert(rows, {
        onConflict: "family_id,weekday",
      });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("지정 공부 요일을 저장했습니다. ✅");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">불러오는 중...</p>
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

          <h1 className="text-xl font-bold">지정 공부 요일</h1>
        </header>

        <section className="p-5">
          <div className="mb-6">
            <p className="text-sm text-[#777]">공부 습관 설정</p>

            <h2 className="mt-1 text-2xl font-bold">
              어떤 요일에 공부할까요? 📅
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#777]">
              선택한 요일만 출석 대상이 됩니다.
              쉬는 날은 연속 공부 기록에 영향을 주지 않습니다.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((day) => {
                const selected = selectedDays.includes(day.weekday);

                return (
                  <button
                    key={day.weekday}
                    type="button"
                    onClick={() => toggleDay(day.weekday)}
                    className={`aspect-square rounded-xl text-sm font-bold transition ${
                      selected
                        ? "bg-[#FFD84D] text-[#252525]"
                        : "bg-[#F2F2F2] text-[#888]"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-xl bg-[#F7F7F7] p-4">
              <p className="text-sm text-[#777]">현재 선택</p>

              <p className="mt-1 font-bold">
                {selectedDays.length === 0
                  ? "선택된 요일 없음"
                  : DAYS.filter((day) =>
                      selectedDays.includes(day.weekday)
                    )
                      .map((day) => `${day.label}요일`)
                      .join(" · ")}
              </p>
            </div>

            <button
              type="button"
              onClick={saveStudyDays}
              disabled={saving}
              className="mt-5 w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
            >
              {saving ? "저장 중..." : "공부 요일 저장"}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-white p-5 text-sm shadow-sm">
            <p className="font-bold">💡 예시</p>

            <p className="mt-2 leading-6 text-[#777]">
              월 · 수 · 금을 선택하면 화요일과 목요일에는 공부하지 않아도
              연속 공부 기록이 끊기지 않습니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}