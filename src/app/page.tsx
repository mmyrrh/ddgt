"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = "home" | "study" | "shop" | "record";
type StudyPlan = {
  id: string;
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
export default function Home() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("home");
  const [completed, setCompleted] = useState(false);

  const [childName, setChildName] = useState("딸");
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todayPlans, setTodayPlans] = useState<StudyPlan[]>([]);

  useEffect(() => {
    async function loadData() {
      // 1. 로그인 확인
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // 2. 가족 정보 가져오기
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

      // 3. 딸 프로필 가져오기
      const { data: child, error: childError } = await supabase
        .from("family_members")
        .select("id, display_name")
        .eq("family_id", family.id)
        .eq("role", "child")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (childError || !child) {
        console.error("딸 프로필 오류:", childError);
        setLoading(false);
        return;
      }

      setChildName(child.display_name);

      // 4. 오늘 공부 계획 가져오기
      const today = getToday();

      const { data: plans, error: plansError } = await supabase
        .from("study_plans")
        .select("id, subject, note")
        .eq("family_id", family.id)
        .eq("target_member_id", child.id)
        .eq("study_date", today)
        .order("sort_order")
        .order("created_at");

      if (plansError) {
  console.error("공부 계획 오류:", plansError);
} else {
  const todayPlanList = plans ?? [];

  setTodayPlans(todayPlanList);

  if (todayPlanList.length > 0) {
    const planIds = todayPlanList.map((plan) => plan.id);

    const { data: completedRecords } = await supabase
      .from("study_records")
      .select("study_plan_id")
      .eq("family_id", family.id)
      .eq("member_id", child.id)
      .in("study_plan_id", planIds);

    const completedCount =
      completedRecords?.length ?? 0;

    setCompleted(
      completedCount === todayPlanList.length
    );
  } else {
    setCompleted(false);
  }
}

      // 5. 현재 포인트 계산
      const { data: pointRows, error: pointsError } = await supabase
        .from("point_transactions")
        .select("amount")
        .eq("family_id", family.id)
        .eq("member_id", child.id);

      if (pointsError) {
        console.error("포인트 오류:", pointsError);
      } else {
        const totalPoints =
          pointRows?.reduce((sum, row) => sum + row.amount, 0) ?? 0;

        setPoints(totalPoints);
      }

      setLoading(false);
    }

    loadData();
  }, [router]);
async function handleCompleteStudy() {
  if (todayPlans.length === 0) {
    alert("오늘 등록된 공부 계획이 없어요.");
    return;
  }

  const { data, error } = await supabase.rpc(
    "complete_today_study",
    {
      p_study_date: getToday(),
    }
  );

  if (error) {
    console.error(error);
    alert("공부 완료 처리 중 오류가 발생했습니다.");
    return;
  }

  const result = data as {
    completed_count: number;
    earned_points: number;
    total_points: number;
  };

  setPoints(result.total_points);
  setCompleted(true);

  if (result.earned_points > 0) {
    alert(
      `공부 완료! 🎉\n+${result.earned_points}P를 받았어요!`
    );
  } else {
    alert("오늘 공부는 이미 완료했어요 😊");
  }
}
if (loading) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
      <p className="font-semibold">딸천재톡 불러오는 중...</p>
    </main>
  );
}
  return (
    <main className="min-h-screen bg-[#F2F2F2] text-[#252525]">
      <div className="mx-auto min-h-screen max-w-md bg-[#F7F7F7] shadow-sm">
        {/* 상단 */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#EAEAEA] bg-[#FFD84D] px-5">
          <h1 className="text-xl font-bold">딸천재톡</h1>

          <button
           onClick={() => router.push("/admin")}
           className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
           aria-label="아빠 관리"
          >
            ⚙️
          </button>
        </header>

        {/* 콘텐츠 */}
        <section className="px-4 pb-28 pt-5">
          {tab === "home" && (
            <>
              {/* 인사 */}
              <div className="mb-5">
                <p className="text-sm text-[#777]">오늘도 화이팅!</p>
                <h2 className="mt-1 text-2xl font-bold">
                  안녕, {childName} 👋
                </h2>
              </div>

              {/* 연속 공부 */}
              <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#777]">연속 공부</p>
                    <p className="mt-1 text-xl font-bold">
                      🔥 5회 연속 공부 중
                    </p>
                  </div>

                  <div className="rounded-full bg-[#FFF2EC] px-3 py-2 text-sm font-bold text-[#E8673C]">
                    +10P 예정
                  </div>
                </div>
              </div>

              {/* 오늘의 공부 */}
              <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#777]">아빠가 보낸 계획</p>
                    <h3 className="mt-1 text-xl font-bold">오늘의 공부 📚</h3>
                  </div>

                  <span className="text-xs text-[#999]">9월 8일</span>
                </div>

                <div className="space-y-3">
  {todayPlans.length === 0 ? (
    <div className="rounded-xl bg-[#F7F7F7] p-5 text-center">
      <p className="font-semibold">오늘 등록된 공부가 없어요 😊</p>
      <p className="mt-1 text-sm text-[#888]">
        아빠가 공부 계획을 등록하면 여기에 나타나요.
      </p>
    </div>
  ) : (
    todayPlans.map((plan, index) => (
      <div
        key={plan.id}
        className="flex items-center rounded-xl bg-[#F7F7F7] p-4"
      >
        <span className="mr-3 text-2xl">
          {index % 2 === 0 ? "📘" : "📕"}
        </span>

        <div>
          <p className="font-bold">{plan.subject}</p>

          <p className="text-sm text-[#777]">
            {plan.note || "오늘의 공부 과목"}
          </p>
        </div>
      </div>
    ))
  )}
</div>

                <button
  onClick={handleCompleteStudy}
  disabled={completed || todayPlans.length === 0}
  className={`mt-5 w-full rounded-xl py-4 font-bold transition ${
    completed
      ? "bg-[#E7F7EE] text-[#23875A]"
      : todayPlans.length === 0
      ? "bg-[#EEEEEE] text-[#999999]"
      : "bg-[#FFD84D] text-[#252525] hover:brightness-95"
  }`}
>
  {completed
    ? "✅ 오늘 공부 완료!"
    : todayPlans.length === 0
    ? "오늘 공부 계획이 없어요"
    : "공부 완료하기"}
</button>
              </div>

              {/* 포인트 */}
              <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-[#777]">내 포인트</p>
                    <p className="mt-1 text-3xl font-bold">
                      ⭐ {points} <span className="text-base">P</span>
                    </p>
                  </div>

                  <button
                    onClick={() => setTab("shop")}
                    className="rounded-xl bg-[#F4F4F4] px-4 py-2 text-sm font-semibold"
                  >
                    상점 가기
                  </button>
                </div>
              </div>

              {/* 보상까지 */}
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-[#777]">다음 보상까지</p>

                <div className="mt-2 flex items-center justify-between">
                  <p className="font-bold">🎬 영화 선택권</p>
                  <p className="text-sm font-bold">{points} / 400P</p>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#EEEEEE]">
                  <div className="h-full w-4/5 rounded-full bg-[#FFD84D]" />
                </div>

                <p className="mt-2 text-right text-xs text-[#777]">
                  {Math.max(400 - points, 0)}P만 더 모으면 돼!
                </p>
              </div>
            </>
          )}

          {tab === "study" && (
            <div>
              <h2 className="mb-4 text-2xl font-bold">공부 📚</h2>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-[#777]">이번 주</p>

                <div className="mt-5 grid grid-cols-5 gap-2 text-center">
                  {[
                    ["월", "✅"],
                    ["화", "−"],
                    ["수", "✅"],
                    ["목", "−"],
                    ["금", "⏳"],
                  ].map(([day, status]) => (
                    <div key={day}>
                      <p className="mb-2 text-sm text-[#777]">{day}</p>
                      <div className="rounded-xl bg-[#F7F7F7] py-3 text-xl">
                        {status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "shop" && (
            <div>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="text-sm text-[#777]">내 포인트</p>
                  <h2 className="text-3xl font-bold">⭐ {points}P</h2>
                </div>

                <span className="text-sm text-[#777]">포인트 상점</span>
              </div>

              <div className="space-y-3">
                {[
                  ["🍦", "아이스크림", "50P"],
                  ["🎮", "게임 30분", "100P"],
                  ["🎬", "영화 선택권", "400P"],
                  ["🍽️", "외식 메뉴 선택권", "500P"],
                ].map(([emoji, title, price]) => (
                  <div
                    key={title}
                    className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center">
                      <span className="mr-4 text-3xl">{emoji}</span>
                      <div>
                        <p className="font-bold">{title}</p>
                        <p className="mt-1 text-sm text-[#777]">{price}</p>
                      </div>
                    </div>

                    <button className="rounded-xl bg-[#FFD84D] px-4 py-2 text-sm font-bold">
                      교환
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "record" && (
            <div>
              <h2 className="mb-4 text-2xl font-bold">나의 기록 🏆</h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-[#777]">연속 공부</p>
                  <p className="mt-2 text-2xl font-bold">🔥 5회</p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-[#777]">누적 포인트</p>
                  <p className="mt-2 text-2xl font-bold">⭐ 620P</p>
                </div>

                <div className="col-span-2 rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-[#777]">최근 획득 배지</p>

                  <div className="mt-4 flex gap-3">
                    <div className="rounded-xl bg-[#FFF8DB] p-4 text-center">
                      <p className="text-3xl">🔥</p>
                      <p className="mt-1 text-xs font-bold">5회 연속</p>
                    </div>

                    <div className="rounded-xl bg-[#FFF8DB] p-4 text-center">
                      <p className="text-3xl">📘</p>
                      <p className="mt-1 text-xs font-bold">수학 시작</p>
                    </div>

                    <div className="rounded-xl bg-[#FFF8DB] p-4 text-center">
                      <p className="text-3xl">⭐</p>
                      <p className="mt-1 text-xs font-bold">첫 100P</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 하단 메뉴 */}
        <nav className="fixed bottom-0 left-1/2 z-30 flex h-20 w-full max-w-md -translate-x-1/2 border-t border-[#E5E5E5] bg-white">
          <MenuButton
            icon="🏠"
            label="홈"
            selected={tab === "home"}
            onClick={() => setTab("home")}
          />

          <MenuButton
            icon="📚"
            label="공부"
            selected={tab === "study"}
            onClick={() => setTab("study")}
          />

          <MenuButton
            icon="🎁"
            label="상점"
            selected={tab === "shop"}
            onClick={() => setTab("shop")}
          />

          <MenuButton
            icon="🏆"
            label="기록"
            selected={tab === "record"}
            onClick={() => setTab("record")}
          />
        </nav>
      </div>
    </main>
  );
}

function MenuButton({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-1 ${
        selected ? "font-bold text-[#252525]" : "text-[#888]"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-xl ${
          selected ? "bg-[#FFF3B3]" : ""
        }`}
      >
        {icon}
      </span>
      <span className="text-xs">{label}</span>
    </button>
  );
}