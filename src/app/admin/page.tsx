"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Child = {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
};

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

  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState("");
  const [childName, setChildName] = useState("");

  const [newChildName, setNewChildName] = useState("");
  const [addingChild, setAddingChild] = useState(false);

  const [studyDate, setStudyDate] = useState(getToday());
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  const [plans, setPlans] = useState<StudyPlan[]>([]);

  const [pendingCount, setPendingCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  /* =========================================================
     초기 데이터
  ========================================================= */

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      /* 가족 */

      const {
        data: family,
        error: familyError,
      } = await supabase
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

      /* 자녀 목록 */

      const {
        data: childRows,
        error: childError,
      } = await supabase
        .from("family_members")
        .select("id, display_name, avatar_emoji")
        .eq("family_id", family.id)
        .eq("role", "child")
        .eq("is_active", true)
        .order("created_at");

      if (childError || !childRows || childRows.length === 0) {
        setMessage("자녀 프로필을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      setChildren(childRows);

      const firstChild = childRows[0];

      setChildId(firstChild.id);
      setChildName(firstChild.display_name);

      /* 승인 대기 교환 신청 */

const {
  data: pendingRows,
  error: pendingError,
} = await supabase
  .from("reward_requests")
  .select("id")
  .eq("family_id", family.id)
  .eq("status", "requested");

if (pendingError) {
  console.error(
    "교환 신청 조회 오류:",
    pendingError
  );
}

setPendingCount(
  pendingRows?.length ?? 0
);

      setLoading(false);
    }

    init();
  }, [router]);

  /* =========================================================
     자녀 선택
  ========================================================= */

  function handleSelectChild(child: Child) {
    setChildId(child.id);
    setChildName(child.display_name);
    setMessage("");
  }

  /* =========================================================
     자녀 추가
  ========================================================= */

  async function handleAddChild(e: FormEvent) {
    e.preventDefault();

    const name = newChildName.trim();

    if (!name) {
      setMessage("아들 이름을 입력해주세요.");
      return;
    }

    setAddingChild(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "add_child",
      {
        p_child_name: name,
        p_avatar_emoji: "👦",
      }
    );

    if (error) {
      console.error("아들 추가 오류:", error);
      setMessage(error.message);
      setAddingChild(false);
      return;
    }

    console.log("추가된 자녀 ID:", data);

    const {
      data: childRows,
      error: childError,
    } = await supabase
      .from("family_members")
      .select("id, display_name, avatar_emoji")
      .eq("family_id", familyId)
      .eq("role", "child")
      .eq("is_active", true)
      .order("created_at");

    if (!childError && childRows) {
      setChildren(childRows);

      const addedChild = childRows.find(
        (child) => child.id === data
      );

      if (addedChild) {
        setChildId(addedChild.id);
        setChildName(addedChild.display_name);
      }
    }

    setNewChildName("");

    setMessage(
      `${name}을(를) 자녀로 추가했습니다. 👦`
    );

    setAddingChild(false);
  }

  /* =========================================================
     선택한 날짜 공부 계획 조회
  ========================================================= */

  useEffect(() => {
    if (!familyId || !childId) return;

    loadPlans();
  }, [familyId, childId, studyDate]);

  async function loadPlans() {
    const {
      data,
      error,
    } = await supabase
      .from("study_plans")
      .select(
        "id, study_date, subject, note"
      )
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

  /* =========================================================
     공부 계획 등록
  ========================================================= */

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!childId) {
      setMessage("공부할 자녀를 선택해주세요.");
      return;
    }

    if (!subject.trim()) {
      setMessage("과목을 입력해주세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const {
      error,
    } = await supabase
      .from("study_plans")
      .insert({
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

    setMessage(
      `${childName}에게 공부 계획을 등록했습니다. ✅`
    );

    await loadPlans();

    setSaving(false);
  }

  /* =========================================================
     공부 계획 삭제
  ========================================================= */

  async function deletePlan(id: string) {
    const ok = window.confirm(
      "이 공부 계획을 삭제할까요?"
    );

    if (!ok) return;

    const {
      error,
    } = await supabase
      .from("study_plans")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "공부 계획을 삭제했습니다."
    );

    await loadPlans();
  }

  /* =========================================================
     로딩
  ========================================================= */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          부모 관리 불러오는 중...
        </p>
      </main>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#F2F2F2] text-[#252525]">
      <div className="mx-auto min-h-screen max-w-md bg-[#F7F7F7]">
        {/* 상단 */}

        <header className="flex h-16 items-center bg-[#FFD84D] px-5">
          <button
            onClick={() => router.push("/")}
            className="mr-4 text-xl"
            aria-label="홈으로"
          >
            ←
          </button>

          <div>
            <h1 className="text-xl font-bold">
              부모 관리
            </h1>

            <p className="text-[10px] text-[#666]">
              👨 부모 전용
            </p>
          </div>
        </header>

        <section className="p-5">
          {/* =================================================
              관리 메뉴
          ================================================= */}

          <div className="mb-7">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-[#777]">
                  관리 메뉴
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  무엇을 관리할까요?
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 공부 요일 */}

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin/study-days"
                  )
                }
                className="rounded-2xl bg-white p-5 text-left shadow-sm transition hover:brightness-95"
              >
                <p className="text-3xl">
                  📅
                </p>

                <p className="mt-3 font-bold">
                  공부요일
                </p>

                <p className="mt-1 text-xs text-[#777]">
                  지정 공부일 설정
                </p>
              </button>

              {/* 상점 상품 */}

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin/rewards"
                  )
                }
                className="rounded-2xl bg-white p-5 text-left shadow-sm transition hover:brightness-95"
              >
                <p className="text-3xl">
                  🎁
                </p>

                <p className="mt-3 font-bold">
                  상점상품
                </p>

                <p className="mt-1 text-xs text-[#777]">
                  보상 상품 등록
                </p>
              </button>

              {/* 교환 신청 */}

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin/reward-requests"
                  )
                }
                className="relative rounded-2xl bg-white p-5 text-left shadow-sm transition hover:brightness-95"
              >
                {pendingCount > 0 && (
                  <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF6B57] px-1 text-xs font-bold text-white">
                    {pendingCount}
                  </span>
                )}

                <p className="text-3xl">
                  ✅
                </p>

                <p className="mt-3 font-bold">
                  교환신청
                </p>

                <p className="mt-1 text-xs text-[#777]">
                  승인 · 거절 관리
                </p>
              </button>

              {/* 자녀 로그인 설정 */}

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin/child-login"
                  )
                }
                className="rounded-2xl bg-white p-5 text-left shadow-sm transition hover:brightness-95"
              >
                <p className="text-3xl">
                  🔐
                </p>

                <p className="mt-3 font-bold">
                  자녀 로그인 설정
                </p>

                <p className="mt-1 text-xs text-[#777]">
                  가족코드 · PIN 설정
                </p>
              </button>
            </div>
          </div>

          {/* =================================================
              자녀 추가
          ================================================= */}

          <div className="mb-7">
            <div className="mb-3">
              <p className="text-sm text-[#777]">
                자녀 관리
              </p>

              <h2 className="mt-1 text-xl font-bold">
                아들 추가 👦
              </h2>
            </div>

            <form
              onSubmit={handleAddChild}
              className="rounded-2xl bg-white p-5 shadow-sm"
            >
              <label className="mb-2 block text-sm font-bold">
                아들 이름
              </label>

              <input
                value={newChildName}
                onChange={(e) =>
                  setNewChildName(
                    e.target.value
                  )
                }
                placeholder="예: 민준"
                disabled={addingChild}
                className="mb-3 w-full rounded-xl border border-[#DDD] p-4"
              />

              <button
                type="submit"
                disabled={addingChild}
                className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
              >
                {addingChild
                  ? "추가 중..."
                  : "아들 추가"}
              </button>
            </form>
          </div>

          {/* =================================================
              공부 계획 대상 자녀 선택
          ================================================= */}

          <div className="mb-5">
            <p className="text-sm text-[#777]">
              공부 계획 관리
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              누구의 공부를 관리할까요? 📚
            </h2>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() =>
                  handleSelectChild(child)
                }
                className={`rounded-2xl p-4 text-left shadow-sm transition ${
                  child.id === childId
                    ? "bg-[#FFD84D]"
                    : "bg-white hover:brightness-95"
                }`}
              >
                <p className="text-3xl">
                  {child.avatar_emoji ?? "👦"}
                </p>

                <p className="mt-2 font-bold">
                  {child.display_name}
                </p>

                <p className="mt-1 text-xs text-[#777]">
                  {child.id === childId
                    ? "선택됨 ✓"
                    : "선택하기"}
                </p>
              </button>
            ))}
          </div>

          <div className="mb-4 rounded-2xl bg-[#FFF4C2] p-4">
            <p className="text-sm text-[#777]">
              현재 선택한 자녀
            </p>

            <p className="mt-1 text-lg font-bold">
              {childName} 👤
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            {/* 날짜 */}

            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold">
                공부 날짜
              </label>

              <input
                type="date"
                value={studyDate}
                onChange={(e) =>
                  setStudyDate(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            {/* 과목 */}

            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold">
                과목
              </label>

              <input
                value={subject}
                onChange={(e) =>
                  setSubject(
                    e.target.value
                  )
                }
                placeholder="예: 수학"
                required
                className="w-full rounded-xl border border-[#DDD] p-4"
              />
            </div>

            {/* 내용 */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-bold">
                공부 내용
              </label>

              <input
                value={note}
                onChange={(e) =>
                  setNote(
                    e.target.value
                  )
                }
                placeholder="예: 문제집 20~25쪽"
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
                : `${childName} 공부 계획 추가`}
            </button>
          </form>

          {/* 메시지 */}

          {message && (
            <div className="mt-4 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          {/* =================================================
              등록된 계획
          ================================================= */}

          <div className="mt-7">
            <div className="mb-3">
              <p className="text-sm text-[#777]">
                {childName}
              </p>

              <h3 className="mt-1 font-bold">
                {studyDate} 공부 계획
              </h3>
            </div>

            {plans.length === 0 ? (
              <div className="rounded-2xl bg-white p-7 text-center shadow-sm">
                <p className="text-3xl">
                  📭
                </p>

                <p className="mt-3 font-bold">
                  등록된 공부 계획이 없습니다.
                </p>

                <p className="mt-1 text-sm text-[#888]">
                  위에서 공부 계획을 추가해주세요.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="min-w-0 pr-4">
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
                      type="button"
                      onClick={() =>
                        deletePlan(
                          plan.id
                        )
                      }
                      className="shrink-0 rounded-lg bg-[#F3F3F3] px-3 py-2 text-sm"
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