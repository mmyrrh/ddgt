"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = "home" | "study" | "shop" | "record";
type Role = "parent" | "child" | "none";

type AppContext = {
  role: Role;
  family_id?: string;
  child_id?: string;
  child_name?: string;
  is_anonymous?: boolean;
};

type StudyPlan = {
  id: string;
  subject: string;
  note: string | null;
};

type Reward = {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  cost_points: number;
  is_active: boolean;
};

type AttendanceStatus =
  | "done"
  | "missed"
  | "today"
  | "future"
  | "rest";

type AttendanceDay = {
  weekday: number;
  label: string;
  date: string;
  status: AttendanceStatus;
};

type CompleteStudyResult = {
  completed_count: number;
  earned_points: number;
  total_points: number;
};

type StreakResult = {
  streak: number;
  bonus_points: number;
  total_points: number;
};

function getToday() {
  const now = new Date();

  const local = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60 * 1000
  );

  return local.toISOString().slice(0, 10);
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentWeekDates() {
  const today = new Date();
  const currentDay = today.getDay();

  const diffToMonday =
    currentDay === 0
      ? -6
      : 1 - currentDay;

  const monday = new Date(today);

  monday.setDate(
    today.getDate() + diffToMonday
  );

  const labels = [
    "월",
    "화",
    "수",
    "목",
    "금",
    "토",
    "일",
  ];

  return labels.map(
    (label, index) => {
      const date = new Date(monday);

      date.setDate(
        monday.getDate() + index
      );

      return {
        weekday: index + 1,
        label,
        date: formatLocalDate(date),
      };
    }
  );
}

export default function Home() {
  const router = useRouter();

  const [role, setRole] =
    useState<Role>("none");

  const [tab, setTab] =
    useState<Tab>("home");

  const [completed, setCompleted] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    requestingRewardId,
    setRequestingRewardId,
  ] = useState("");

  const [childName, setChildName] =
    useState("딸");

  const [points, setPoints] =
    useState(0);

  const [streak, setStreak] =
    useState(0);

  const [todayPlans, setTodayPlans] =
    useState<StudyPlan[]>([]);

  const [attendance, setAttendance] =
    useState<AttendanceDay[]>([]);

  const [rewards, setRewards] =
    useState<Reward[]>([]);

  const [
    pendingRewardIds,
    setPendingRewardIds,
  ] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      /* -----------------------------------------------
         1. Supabase 로그인 세션 확인
      ----------------------------------------------- */

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      /* -----------------------------------------------
         2. 현재 사용자가 부모인지 자녀인지 확인
      ----------------------------------------------- */

      const {
        data: contextData,
        error: contextError,
      } = await supabase.rpc(
        "get_my_app_context"
      );

      if (contextError) {
        console.error(
          "사용자 정보 오류:",
          contextError
        );

        setLoading(false);
        return;
      }

      const context =
        contextData as AppContext;

      if (context.role === "none") {
        if (context.is_anonymous) {
          router.replace(
            "/child-login"
          );
        } else {
          router.replace("/setup");
        }

        return;
      }

      if (
        !context.family_id ||
        !context.child_id
      ) {
        console.error(
          "가족 또는 자녀 정보를 찾을 수 없습니다."
        );

        setLoading(false);
        return;
      }

      const familyId =
        context.family_id;

      const childId =
        context.child_id;

      setRole(context.role);

      setChildName(
        context.child_name || "딸"
      );

      const todayDate = getToday();

      /* -----------------------------------------------
         3. 실제 상점
      ----------------------------------------------- */

      const {
        data: rewardRows,
        error: rewardsError,
      } = await supabase
        .from("rewards")
        .select(
          "id, title, description, emoji, cost_points, is_active"
        )
        .eq(
          "family_id",
          familyId
        )
        .eq(
          "is_active",
          true
        )
        .order("cost_points")
        .order("created_at");

      if (rewardsError) {
        console.error(
          "상점 상품 오류:",
          rewardsError
        );
      } else {
        setRewards(
          rewardRows ?? []
        );
      }

      /* -----------------------------------------------
         4. 교환 승인 대기
      ----------------------------------------------- */

      const {
        data: pendingRows,
        error: pendingError,
      } = await supabase
        .from(
          "reward_requests"
        )
        .select("reward_id")
        .eq(
          "family_id",
          familyId
        )
        .eq(
          "member_id",
          childId
        )
        .eq(
          "status",
          "requested"
        );

      if (pendingError) {
        console.error(
          "교환 신청 오류:",
          pendingError
        );
      } else {
        setPendingRewardIds(
          (pendingRows ?? []).map(
            (row) =>
              row.reward_id
          )
        );
      }

      /* -----------------------------------------------
         5. 실제 출석판
      ----------------------------------------------- */

      const weekDates =
        getCurrentWeekDates();

      const weekStart =
        weekDates[0].date;

      const weekEnd =
        weekDates[6].date;

      const [
        {
          data: studyDayRows,
          error: studyDaysError,
        },
        {
          data: weekRecords,
          error: recordsError,
        },
      ] = await Promise.all([
        supabase
          .from("study_days")
          .select(
            "weekday, is_enabled"
          )
          .eq(
            "family_id",
            familyId
          ),

        supabase
          .from(
            "study_records"
          )
          .select(
            "study_date"
          )
          .eq(
            "family_id",
            familyId
          )
          .eq(
            "member_id",
            childId
          )
          .gte(
            "study_date",
            weekStart
          )
          .lte(
            "study_date",
            weekEnd
          ),
      ]);

      if (studyDaysError) {
        console.error(
          "공부 요일 오류:",
          studyDaysError
        );
      }

      if (recordsError) {
        console.error(
          "출석 기록 오류:",
          recordsError
        );
      }

      const enabledDays =
        new Set(
          (studyDayRows ?? [])
            .filter(
              (row) =>
                row.is_enabled
            )
            .map(
              (row) =>
                row.weekday
            )
        );

      const completedDates =
        new Set(
          (weekRecords ?? []).map(
            (row) =>
              row.study_date
          )
        );

      const attendanceData:
        AttendanceDay[] =
        weekDates.map(
          (day) => {
            let status:
              AttendanceStatus;

            if (
              !enabledDays.has(
                day.weekday
              )
            ) {
              status = "rest";
            } else if (
              completedDates.has(
                day.date
              )
            ) {
              status = "done";
            } else if (
              day.date < todayDate
            ) {
              status = "missed";
            } else if (
              day.date ===
              todayDate
            ) {
              status = "today";
            } else {
              status = "future";
            }

            return {
              ...day,
              status,
            };
          }
        );

      setAttendance(
        attendanceData
      );

      /* -----------------------------------------------
         6. 오늘 공부 계획
      ----------------------------------------------- */

      const {
        data: plans,
        error: plansError,
      } = await supabase
        .from(
          "study_plans"
        )
        .select(
          "id, subject, note"
        )
        .eq(
          "family_id",
          familyId
        )
        .eq(
          "target_member_id",
          childId
        )
        .eq(
          "study_date",
          todayDate
        )
        .order(
          "sort_order"
        )
        .order(
          "created_at"
        );

      if (plansError) {
        console.error(
          "공부 계획 오류:",
          plansError
        );
      } else {
        const todayPlanList =
          plans ?? [];

        setTodayPlans(
          todayPlanList
        );

        if (
          todayPlanList.length >
          0
        ) {
          const planIds =
            todayPlanList.map(
              (plan) =>
                plan.id
            );

          const {
            data:
              completedRecords,
          } = await supabase
            .from(
              "study_records"
            )
            .select(
              "study_plan_id"
            )
            .eq(
              "family_id",
              familyId
            )
            .eq(
              "member_id",
              childId
            )
            .in(
              "study_plan_id",
              planIds
            );

          const completedCount =
            completedRecords?.length ??
            0;

          setCompleted(
            completedCount ===
              todayPlanList.length
          );
        } else {
          setCompleted(false);
        }
      }

      /* -----------------------------------------------
         7. 실제 포인트
      ----------------------------------------------- */

      const {
        data: pointRows,
        error: pointsError,
      } = await supabase
        .from(
          "point_transactions"
        )
        .select("amount")
        .eq(
          "family_id",
          familyId
        )
        .eq(
          "member_id",
          childId
        );

      if (pointsError) {
        console.error(
          "포인트 오류:",
          pointsError
        );
      } else {
        const totalPoints =
          pointRows?.reduce(
            (sum, row) =>
              sum + row.amount,
            0
          ) ?? 0;

        setPoints(
          totalPoints
        );
      }

      /* -----------------------------------------------
         8. 실제 연속 공부
      ----------------------------------------------- */

      const {
        data: streakData,
        error: streakError,
      } = await supabase.rpc(
        "refresh_streak_status",
        {
          p_today:
            todayDate,
          p_award: false,
        }
      );

      if (streakError) {
        console.error(
          "연속 공부 계산 오류:",
          streakError
        );
      } else if (
        streakData
      ) {
        const result =
          streakData as StreakResult;

        setStreak(
          Number(
            result.streak ??
              0
          )
        );
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  /* =====================================================
     공부 완료
  ===================================================== */

  async function handleCompleteStudy() {
    if (
      todayPlans.length ===
      0
    ) {
      alert(
        "오늘 등록된 공부 계획이 없어요."
      );

      return;
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "complete_today_study",
      {
        p_study_date:
          getToday(),
      }
    );

    if (error) {
      console.error(error);

      alert(
        "공부 완료 처리 중 오류가 발생했습니다."
      );

      return;
    }

    const result =
      data as CompleteStudyResult;

    const {
      data: streakData,
      error: streakError,
    } = await supabase.rpc(
      "refresh_streak_status",
      {
        p_today:
          getToday(),
        p_award: true,
      }
    );

    let bonusPoints = 0;

    if (streakError) {
      console.error(
        "연속 공부 보너스 오류:",
        streakError
      );

      setPoints(
        Number(
          result.total_points
        )
      );
    } else if (
      streakData
    ) {
      const streakResult =
        streakData as StreakResult;

      setStreak(
        Number(
          streakResult.streak ??
            0
        )
      );

      setPoints(
        Number(
          streakResult.total_points ??
            result.total_points
        )
      );

      bonusPoints =
        Number(
          streakResult.bonus_points ??
            0
        );
    }

    setCompleted(true);

    setAttendance(
      (current) =>
        current.map(
          (day) =>
            day.date ===
              getToday() &&
            day.status !==
              "rest"
              ? {
                  ...day,
                  status:
                    "done",
                }
              : day
        )
    );

    if (
      result.earned_points >
      0
    ) {
      let message =
        `공부 완료! 🎉\n` +
        `공부 포인트 +${result.earned_points}P`;

      if (
        bonusPoints > 0
      ) {
        message +=
          `\n🔥 연속 공부 보너스 +${bonusPoints}P`;
      }

      alert(message);
    } else {
      alert(
        "오늘 공부는 이미 완료했어요 😊"
      );
    }
  }

  /* =====================================================
     실제 교환 신청
  ===================================================== */

  async function handleRewardClick(
    reward: Reward
  ) {
    if (
      pendingRewardIds.includes(
        reward.id
      )
    ) {
      alert(
        "이미 부모 승인을 기다리고 있어요."
      );

      return;
    }

    if (
      points <
      reward.cost_points
    ) {
      alert(
        `${
          reward.cost_points -
          points
        }P가 더 필요해요.`
      );

      return;
    }

    const ok =
      window.confirm(
        `${reward.emoji || "🎁"} ${reward.title}\n\n` +
          `${reward.cost_points}P 상품을 교환 신청할까요?\n\n` +
          `부모가 승인하면 포인트가 차감됩니다.`
      );

    if (!ok) return;

    setRequestingRewardId(
      reward.id
    );

    const {
      data,
      error,
    } = await supabase.rpc(
      "request_reward",
      {
        p_reward_id:
          reward.id,
      }
    );

    setRequestingRewardId("");

    if (error) {
      alert(error.message);
      return;
    }

    setPendingRewardIds(
      (current) => [
        ...current,
        reward.id,
      ]
    );

    const result =
      data as {
        reward_title: string;
        cost_points: number;
      };

    alert(
      `교환 신청 완료! 🎁\n\n` +
        `${result.reward_title}\n` +
        `${result.cost_points}P\n\n` +
        `부모의 승인을 기다려주세요.`
    );
  }

  /* =====================================================
     자녀 자동로그인 해제
  ===================================================== */

  async function handleChildLogout() {
    const ok =
      window.confirm(
        "이 기기에서 자녀 자동로그인을 해제할까요?\n\n다음 접속 때 가족 코드와 PIN을 다시 입력해야 합니다."
      );

    if (!ok) return;

    await supabase.auth.signOut();

    router.replace(
      "/child-login"
    );

    router.refresh();
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          SDgram 불러오는 중...
        </p>
      </main>
    );
  }

  /* =====================================================
     계산
  ===================================================== */

  const completedThisWeek =
    attendance.filter(
      (day) =>
        day.status ===
        "done"
    ).length;

  const scheduledThisWeek =
    attendance.filter(
      (day) =>
        day.status !==
        "rest"
    ).length;

  const nextReward =
    rewards.find(
      (reward) =>
        reward.cost_points >
        points
    ) ??
    rewards[
      rewards.length - 1
    ] ??
    null;

  const remainingPoints =
    nextReward
      ? Math.max(
          nextReward.cost_points -
            points,
          0
        )
      : 0;

  const rewardProgress =
    nextReward
      ? Math.min(
          (points /
            nextReward.cost_points) *
            100,
          100
        )
      : 0;

  /* =====================================================
     UI
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#F2F2F2] text-[#252525]">
      <div className="mx-auto min-h-screen max-w-md bg-[#F7F7F7] shadow-sm">

        {/* 상단 */}

        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#EAEAEA] bg-[#FFD84D] px-5">
          <div>
            <h1 className="text-xl font-bold">
              SDgram
            </h1>

            <p className="text-[10px] text-[#666]">
              {role ===
              "child"
                ? "👧 자녀 모드"
                : "👨 부모 모드"}
            </p>
          </div>

          {role ===
          "parent" ? (
            <button
              onClick={() =>
                router.push(
                  "/admin"
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
              aria-label="부모 관리"
            >
              ⚙️
            </button>
          ) : (
            <button
              type="button"
              onClick={
                handleChildLogout
              }
              className="rounded-lg bg-white/50 px-3 py-2 text-xs font-bold"
            >
              로그아웃
            </button>
          )}
        </header>

        <section className="px-4 pb-28 pt-5">

          {/* =================================================
              HOME
          ================================================= */}

          {tab ===
            "home" && (
            <>
              <div className="mb-5">
                <p className="text-sm text-[#777]">
                  오늘도 화이팅!
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  안녕,{" "}
                  {childName} 👋
                </h2>
              </div>

              {/* 연속 공부 */}

              <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#777]">
                      연속 공부
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      🔥{" "}
                      {streak}
                      회 연속
                    </p>
                  </div>

                  <div className="rounded-full bg-[#FFF2EC] px-3 py-2 text-sm font-bold text-[#E8673C]">
                    {streak <
                    3
                      ? `3회까지 ${
                          3 -
                          streak
                        }회`
                      : streak <
                        5
                      ? `5회까지 ${
                          5 -
                          streak
                        }회`
                      : "5회 보너스 달성 🎉"}
                  </div>
                </div>
              </div>

              {/* 오늘 공부 */}

              <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#777]">
                      부모가 보낸 계획
                    </p>

                    <h3 className="mt-1 text-xl font-bold">
                      오늘의 공부 📚
                    </h3>
                  </div>

                  <span className="text-xs text-[#999]">
                    {getToday()}
                  </span>
                </div>

                <div className="space-y-3">
                  {todayPlans.length ===
                  0 ? (
                    <div className="rounded-xl bg-[#F7F7F7] p-5 text-center">
                      <p className="font-semibold">
                        오늘 등록된 공부가 없어요 😊
                      </p>

                      <p className="mt-1 text-sm text-[#888]">
                        부모가 공부 계획을 등록하면
                        여기에 나타나요.
                      </p>
                    </div>
                  ) : (
                    todayPlans.map(
                      (
                        plan,
                        index
                      ) => (
                        <div
                          key={
                            plan.id
                          }
                          className="flex items-center rounded-xl bg-[#F7F7F7] p-4"
                        >
                          <span className="mr-3 text-2xl">
                            {index %
                              2 ===
                            0
                              ? "📘"
                              : "📕"}
                          </span>

                          <div>
                            <p className="font-bold">
                              {
                                plan.subject
                              }
                            </p>

                            <p className="text-sm text-[#777]">
                              {plan.note ||
                                "오늘의 공부 과목"}
                            </p>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>

                <button
                  onClick={
                    handleCompleteStudy
                  }
                  disabled={
                    completed ||
                    todayPlans.length ===
                      0
                  }
                  className={`mt-5 w-full rounded-xl py-4 font-bold transition ${
                    completed
                      ? "bg-[#E7F7EE] text-[#23875A]"
                      : todayPlans.length ===
                        0
                      ? "bg-[#EEEEEE] text-[#999999]"
                      : "bg-[#FFD84D] text-[#252525] hover:brightness-95"
                  }`}
                >
                  {completed
                    ? "✅ 오늘 공부 완료!"
                    : todayPlans.length ===
                      0
                    ? "오늘 공부 계획이 없어요"
                    : "공부 완료하기"}
                </button>
              </div>

              {/* 포인트 */}

              <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-[#777]">
                      내 포인트
                    </p>

                    <p className="mt-1 text-3xl font-bold">
                      ⭐{" "}
                      {points}{" "}
                      <span className="text-base">
                        P
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setTab(
                        "shop"
                      )
                    }
                    className="rounded-xl bg-[#F4F4F4] px-4 py-2 text-sm font-semibold"
                  >
                    상점 가기
                  </button>
                </div>
              </div>

              {/* 다음 보상 */}

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-[#777]">
                  다음 보상까지
                </p>

                {nextReward ? (
                  <>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="font-bold">
                        {nextReward.emoji ||
                          "🎁"}{" "}
                        {
                          nextReward.title
                        }
                      </p>

                      <p className="text-sm font-bold">
                        {points} /{" "}
                        {
                          nextReward.cost_points
                        }
                        P
                      </p>
                    </div>

                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#EEEEEE]">
                      <div
                        className="h-full rounded-full bg-[#FFD84D]"
                        style={{
                          width: `${rewardProgress}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-right text-xs text-[#777]">
                      {remainingPoints >
                      0
                        ? `${remainingPoints}P만 더 모으면 돼!`
                        : "이 보상을 받을 수 있어요! 🎉"}
                    </p>
                  </>
                ) : (
                  <div className="mt-3 rounded-xl bg-[#F7F7F7] p-4 text-center text-sm text-[#777]">
                    부모가 상점 상품을 등록하면
                    여기에 표시돼요.
                  </div>
                )}
              </div>
            </>
          )}

          {/* =================================================
              STUDY
          ================================================= */}

          {tab ===
            "study" && (
            <div>
              <h2 className="mb-1 text-2xl font-bold">
                공부 출석판 📚
              </h2>

              <p className="mb-5 text-sm text-[#777]">
                이번 주 실제 공부 기록이에요.
              </p>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#777]">
                      이번 주 완료
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      {
                        completedThisWeek
                      }
                      회
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-[#777]">
                      지정 공부일
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      {
                        scheduledThisWeek
                      }
                      회
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center">
                  {attendance.map(
                    (day) => {
                      let symbol =
                        "−";

                      let background =
                        "bg-[#F3F3F3]";

                      if (
                        day.status ===
                        "done"
                      ) {
                        symbol =
                          "✅";

                        background =
                          "bg-[#E7F7EE]";
                      }

                      if (
                        day.status ===
                        "missed"
                      ) {
                        symbol =
                          "❌";

                        background =
                          "bg-[#FFF0F0]";
                      }

                      if (
                        day.status ===
                        "today"
                      ) {
                        symbol =
                          "⏳";

                        background =
                          "bg-[#FFF4C2]";
                      }

                      if (
                        day.status ===
                        "future"
                      ) {
                        symbol =
                          "○";

                        background =
                          "bg-[#F7F7F7]";
                      }

                      return (
                        <div
                          key={
                            day.date
                          }
                        >
                          <p className="mb-2 text-sm font-semibold">
                            {
                              day.label
                            }
                          </p>

                          <div
                            className={`flex aspect-square items-center justify-center rounded-xl text-xl ${background}`}
                          >
                            {
                              symbol
                            }
                          </div>

                          <p className="mt-2 text-[11px] text-[#999]">
                            {Number(
                              day.date.slice(
                                8
                              )
                            )}
                          </p>
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="mt-6 border-t border-[#EEEEEE] pt-4">
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#777]">
                    <span>
                      ✅ 완료
                    </span>

                    <span>
                      ⏳ 오늘
                    </span>

                    <span>
                      ❌ 결석
                    </span>

                    <span>
                      ○ 예정
                    </span>

                    <span>
                      − 쉬는 날
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-[#777]">
                  현재 연속 공부
                </p>

                <p className="mt-2 text-2xl font-bold">
                  🔥{" "}
                  {streak}
                  회 연속
                </p>

                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-[#F7F7F7] p-3">
                    <span>
                      🔥 3회 연속
                    </span>

                    <span className="font-bold">
                      +10P
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-[#F7F7F7] p-3">
                    <span>
                      🔥 5회 연속
                    </span>

                    <span className="font-bold">
                      +20P
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              SHOP
          ================================================= */}

          {tab ===
            "shop" && (
            <div>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="text-sm text-[#777]">
                    내 포인트
                  </p>

                  <h2 className="text-3xl font-bold">
                    ⭐{" "}
                    {points}P
                  </h2>
                </div>

                <span className="text-sm text-[#777]">
                  포인트 상점
                </span>
              </div>

              {rewards.length ===
              0 ? (
                <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                  <p className="text-4xl">
                    🎁
                  </p>

                  <p className="mt-3 font-bold">
                    아직 상품이 없어요
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards.map(
                    (reward) => {
                      const affordable =
                        points >=
                        reward.cost_points;

                      const pending =
                        pendingRewardIds.includes(
                          reward.id
                        );

                      const requesting =
                        requestingRewardId ===
                        reward.id;

                      return (
                        <div
                          key={
                            reward.id
                          }
                          className="rounded-2xl bg-white p-5 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex min-w-0 items-center">
                              <span className="mr-4 text-3xl">
                                {reward.emoji ||
                                  "🎁"}
                              </span>

                              <div className="min-w-0">
                                <p className="font-bold">
                                  {
                                    reward.title
                                  }
                                </p>

                                {reward.description && (
                                  <p className="mt-1 text-sm text-[#777]">
                                    {
                                      reward.description
                                    }
                                  </p>
                                )}

                                <p className="mt-2 text-sm font-bold">
                                  ⭐{" "}
                                  {
                                    reward.cost_points
                                  }
                                  P
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleRewardClick(
                                  reward
                                )
                              }
                              disabled={
                                pending ||
                                requesting ||
                                !affordable
                              }
                              className={`ml-3 shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${
                                pending
                                  ? "bg-[#FFF4C2] text-[#8A6A00]"
                                  : affordable
                                  ? "bg-[#FFD84D] text-[#252525]"
                                  : "bg-[#EEEEEE] text-[#999]"
                              }`}
                            >
                              {requesting
                                ? "신청 중..."
                                : pending
                                ? "승인 대기"
                                : affordable
                                ? "교환 신청"
                                : "포인트 부족"}
                            </button>
                          </div>

                          {!affordable &&
                            !pending && (
                              <p className="mt-3 text-right text-xs text-[#999]">
                                {reward.cost_points -
                                  points}
                                P가 더 필요해요.
                              </p>
                            )}

                          {pending && (
                            <p className="mt-3 text-right text-xs font-semibold text-[#A07B00]">
                              부모의 승인을 기다리고 있어요.
                            </p>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================
              RECORD
          ================================================= */}

          {tab ===
            "record" && (
            <div>
              <h2 className="mb-4 text-2xl font-bold">
                나의 기록 🏆
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-[#777]">
                    연속 공부
                  </p>

                  <p className="mt-2 text-2xl font-bold">
                    🔥{" "}
                    {streak}회
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-[#777]">
                    현재 포인트
                  </p>

                  <p className="mt-2 text-2xl font-bold">
                    ⭐{" "}
                    {points}P
                  </p>
                </div>

                <div className="col-span-2 rounded-2xl bg-white p-5 shadow-sm">
                  <p className="font-bold">
                    📚 이번 주 공부
                  </p>

                  <p className="mt-2 text-sm text-[#777]">
                    지정 공부일{" "}
                    {
                      scheduledThisWeek
                    }
                    회 중{" "}
                    {
                      completedThisWeek
                    }
                    회를 완료했습니다.
                  </p>
                </div>

                <div className="col-span-2 rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">
                        🎁 포인트 상점
                      </p>

                      <p className="mt-1 text-sm text-[#777]">
                        승인 대기{" "}
                        {
                          pendingRewardIds.length
                        }
                        건
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setTab(
                          "shop"
                        )
                      }
                      className="rounded-xl bg-[#FFD84D] px-4 py-2 text-sm font-bold"
                    >
                      상점 보기
                    </button>
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
            selected={
              tab === "home"
            }
            onClick={() =>
              setTab("home")
            }
          />

          <MenuButton
            icon="📚"
            label="공부"
            selected={
              tab === "study"
            }
            onClick={() =>
              setTab("study")
            }
          />

          <MenuButton
            icon="🎁"
            label="상점"
            selected={
              tab === "shop"
            }
            onClick={() =>
              setTab("shop")
            }
          />

          <MenuButton
            icon="🏆"
            label="기록"
            selected={
              tab === "record"
            }
            onClick={() =>
              setTab("record")
            }
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
        selected
          ? "font-bold text-[#252525]"
          : "text-[#888]"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-xl ${
          selected
            ? "bg-[#FFF3B3]"
            : ""
        }`}
      >
        {icon}
      </span>

      <span className="text-xs">
        {label}
      </span>
    </button>
  );
}

