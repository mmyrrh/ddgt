"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StudyPlan = {
  id: string;
  study_date: string;
  subject: string;
  note: string | null;
};

function getToday() {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60 * 1000
  );

  return local.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const router = useRouter();

  const [familyId, setFamilyId] = useState("");
  const [childId, setChildId] = useState("");
  const [childName, setChildName] = useState("");

  const [studyDate, setStudyDate] = useState(getToday());
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  const [plans, setPlans] = useState<StudyPlan[]>([]);
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

      const { data: family } = await supabase
        .from("families")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .single();

      if (!family) {
        router.replace("/setup");
        return;
      }

      setFamilyId(family.id);

      const { data: child } = await supabase
        .from("family_members")
        .select("id, display_name")
        .eq("family_id", family.id)
        .eq("role", "child")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!child) {
        setMessage("딸 프로필을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      setChildId(child.id);
      setChildName(child.display_name);

      setLoading(false);
    }

    init();
  }, [router]);

  useEffect(() => {
    if (!familyId || !childId) return;

    loadPlans();
  }, [familyId, childId, studyDate]);

  async function loadPlans() {
    const { data, error } = await supabase
      .from("study_plans")
      .select("id, study_date, subject, note")
      .eq("family_id", familyId)
      .eq("target_member_id", childId)
      .eq("study_date", studyDate)
      .order("sort_order")
      .order("created_at");

    if (error) {
      setMessage(error.message);
      return;
    }

    setPlans(data ?? []);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!subject.trim()) return;

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase.from("study_plans").insert({
      family_id: familyId,
      target_member_id: childId,
      study_date: studyDate,
      subject: subject.trim(),
      note: note.trim() || null,
      created_by: user.id,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSubject("");
    setNote("");
    setMessage("공부 계획을 등록했습니다. ✅");

    await loadPlans();

    setSaving(false);
  }

  async function deletePlan(id: string) {
    const { error } = await supabase
      .from("study_plans")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadPlans();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        불러오는 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F2F2] text-[#252525]">
      <div className="mx-auto min-h-screen max-w-md bg-[#F7F7F7]">
        <header className="flex h-16 items-center bg-[#FFD84D] px-5">
          <button
            onClick={() => router.push("/")}
            className="mr-4 text-xl"
          >
            ←
          </button>

          <h1 className="text-xl font-bold">아빠 관리</h1>
        </header>

        <section className="p-5">
          <div className="mb-5">
            <p className="text-sm text-[#777]">공부 계획 관리</p>

            <h2 className="mt-1 text-2xl font-bold">
              {childName}의 공부 📚
            </h2>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold">
                공부 날짜
              </label>

              <input
                type="date"
                value={studyDate}
                onChange={(e) => setStudyDate(e.target.value)}
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold">
                과목
              </label>

              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="예: 수학"
                required
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-bold">
                간단한 내용
              </label>

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="선택사항"
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
            >
              {saving ? "등록 중..." : "공부 계획 추가"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          <div className="mt-7">
            <h3 className="mb-3 font-bold">
              {studyDate} 공부 계획
            </h3>

            {plans.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-[#888]">
                등록된 공부 계획이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div>
                      <p className="font-bold">
                        📘 {plan.subject}
                      </p>

                      {plan.note && (
                        <p className="mt-1 text-sm text-[#777]">
                          {plan.note}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => deletePlan(plan.id)}
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