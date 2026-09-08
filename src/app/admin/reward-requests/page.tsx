"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RequestStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "cancelled";

type RequestRow = {
  id: string;
  reward_id: string;
  cost_points: number;
  status: RequestStatus;
  requested_at: string;
  decided_at: string | null;
};

type RewardRow = {
  id: string;
  title: string;
  emoji: string | null;
};

type RequestItem = RequestRow & {
  reward_title: string;
  reward_emoji: string;
};

function statusText(status: RequestStatus) {
  if (status === "requested") return "승인 대기";
  if (status === "approved") return "승인 완료";
  if (status === "rejected") return "거절";
  return "취소";
}

export default function RewardRequestsPage() {
  const router = useRouter();

  const [familyId, setFamilyId] = useState("");
  const [childId, setChildId] = useState("");
  const [childName, setChildName] = useState("");

  const [points, setPoints] = useState(0);
  const [requests, setRequests] = useState<RequestItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
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

      const {
        data: child,
        error: childError,
      } = await supabase
        .from("family_members")
        .select("id, display_name")
        .eq("family_id", family.id)
        .eq("role", "child")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (childError || !child) {
        setMessage("딸 프로필을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      setFamilyId(family.id);
      setChildId(child.id);
      setChildName(child.display_name);

      await loadData(family.id, child.id);

      setLoading(false);
    }

    init();
  }, [router]);

  async function loadData(
    targetFamilyId: string,
    targetChildId: string
  ) {
    const {
      data: requestRows,
      error: requestError,
    } = await supabase
      .from("reward_requests")
      .select(
        "id, reward_id, cost_points, status, requested_at, decided_at"
      )
      .eq("family_id", targetFamilyId)
      .eq("member_id", targetChildId)
      .order("requested_at", {
        ascending: false,
      });

    if (requestError) {
      setMessage(requestError.message);
      return;
    }

    const rows =
      (requestRows ?? []) as RequestRow[];

    const rewardIds = [
      ...new Set(rows.map((row) => row.reward_id)),
    ];

    let rewardRows: RewardRow[] = [];

    if (rewardIds.length > 0) {
      const {
        data,
        error,
      } = await supabase
        .from("rewards")
        .select("id, title, emoji")
        .in("id", rewardIds);

      if (error) {
        setMessage(error.message);
        return;
      }

      rewardRows =
        (data ?? []) as RewardRow[];
    }

    const rewardMap = new Map(
      rewardRows.map((reward) => [
        reward.id,
        reward,
      ])
    );

    const merged: RequestItem[] =
      rows.map((row) => {
        const reward =
          rewardMap.get(row.reward_id);

        return {
          ...row,
          reward_title:
            reward?.title ?? "삭제된 상품",
          reward_emoji:
            reward?.emoji ?? "🎁",
        };
      });

    setRequests(merged);

    const {
      data: pointRows,
      error: pointError,
    } = await supabase
      .from("point_transactions")
      .select("amount")
      .eq("family_id", targetFamilyId)
      .eq("member_id", targetChildId);

    if (pointError) {
      setMessage(pointError.message);
      return;
    }

    const totalPoints =
      pointRows?.reduce(
        (sum, row) => sum + row.amount,
        0
      ) ?? 0;

    setPoints(totalPoints);
  }

  async function decideRequest(
    request: RequestItem,
    decision: "approved" | "rejected"
  ) {
    const action =
      decision === "approved"
        ? "승인"
        : "거절";

    const ok = window.confirm(
      `${request.reward_emoji} ${request.reward_title}\n\n` +
        `${request.cost_points}P 교환을 ${action}할까요?` +
        (decision === "approved"
          ? "\n승인하면 포인트가 실제로 차감됩니다."
          : "")
    );

    if (!ok) return;

    setProcessingId(request.id);
    setMessage("");

    const {
      data,
      error,
    } = await supabase.rpc(
      "decide_reward_request",
      {
        p_request_id: request.id,
        p_decision: decision,
      }
    );

    setProcessingId("");

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = data as {
      status: string;
      total_points: number;
    };

    setPoints(Number(result.total_points ?? points));

    setMessage(
      decision === "approved"
        ? `${request.reward_title} 교환을 승인했습니다. ✅`
        : `${request.reward_title} 교환을 거절했습니다.`
    );

    await loadData(familyId, childId);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          교환 신청 불러오는 중...
        </p>
      </main>
    );
  }

  const pendingRequests =
    requests.filter(
      (request) =>
        request.status === "requested"
    );

  const historyRequests =
    requests.filter(
      (request) =>
        request.status !== "requested"
    );

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
            교환 신청 관리
          </h1>
        </header>

        <section className="p-5">
          <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-[#777]">
              {childName} 현재 포인트
            </p>

            <p className="mt-1 text-3xl font-bold">
              ⭐ {points}P
            </p>
          </div>

          {message && (
            <div className="mb-5 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          <div className="mb-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                승인 대기 🎁
              </h2>

              <span className="text-sm text-[#777]">
                {pendingRequests.length}건
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="rounded-2xl bg-white p-7 text-center text-[#888]">
                승인 대기 중인 상품이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center">
                      <span className="mr-4 text-3xl">
                        {request.reward_emoji}
                      </span>

                      <div>
                        <p className="font-bold">
                          {request.reward_title}
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          ⭐ {request.cost_points}P
                        </p>

                        <p className="mt-1 text-xs text-[#999]">
                          {new Date(
                            request.requested_at
                          ).toLocaleString("ko-KR")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={
                          processingId === request.id
                        }
                        onClick={() =>
                          decideRequest(
                            request,
                            "rejected"
                          )
                        }
                        className="rounded-xl bg-[#F1F1F1] py-3 font-bold disabled:opacity-50"
                      >
                        거절
                      </button>

                      <button
                        type="button"
                        disabled={
                          processingId === request.id
                        }
                        onClick={() =>
                          decideRequest(
                            request,
                            "approved"
                          )
                        }
                        className="rounded-xl bg-[#FFD84D] py-3 font-bold disabled:opacity-50"
                      >
                        {processingId === request.id
                          ? "처리 중..."
                          : "승인"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-xl font-bold">
              처리 내역
            </h2>

            {historyRequests.length === 0 ? (
              <div className="rounded-2xl bg-white p-7 text-center text-[#888]">
                아직 처리 내역이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {historyRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center">
                      <span className="mr-4 text-2xl">
                        {request.reward_emoji}
                      </span>

                      <div>
                        <p className="font-bold">
                          {request.reward_title}
                        </p>

                        <p className="mt-1 text-sm text-[#777]">
                          {request.cost_points}P
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-2 text-xs font-bold ${
                        request.status === "approved"
                          ? "bg-[#E7F7EE] text-[#23875A]"
                          : "bg-[#F1F1F1] text-[#777]"
                      }`}
                    >
                      {statusText(request.status)}
                    </span>
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