"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Child = {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
};

export default function ChildLoginAdminPage() {
  const router = useRouter();

  const [familyCode, setFamilyCode] =
    useState("");

  const [children, setChildren] =
    useState<Child[]>([]);

  const [selectedChildId, setSelectedChildId] =
    useState("");

  const [pin, setPin] =
    useState("");

  const [confirmPin, setConfirmPin] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  /* =========================================================
     가족 정보 + 자녀 목록 불러오기
  ========================================================= */

  useEffect(() => {
    async function loadFamily() {
      setLoading(true);
      setMessage("");

      const {
        data: {
          user,
        },
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
        .select("id, family_code")
        .eq("owner_user_id", user.id)
        .limit(1)
        .single();

      if (familyError || !family) {
        console.error(
          "가족 정보 불러오기 오류:",
          familyError
        );

        setMessage(
          "가족 정보를 불러올 수 없습니다."
        );

        setLoading(false);
        return;
      }

      setFamilyCode(
        family.family_code ?? ""
      );

      const {
        data: childData,
        error: childError,
      } = await supabase
        .from("family_members")
        .select(
          "id, display_name, avatar_emoji"
        )
        .eq(
          "family_id",
          family.id
        )
        .eq(
          "role",
          "child"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (childError) {
        console.error(
          "자녀 목록 불러오기 오류:",
          childError
        );

        setMessage(
          "자녀 목록을 불러올 수 없습니다."
        );

        setLoading(false);
        return;
      }

      const loadedChildren =
        (childData ?? []) as Child[];

      setChildren(
        loadedChildren
      );

      if (
        loadedChildren.length > 0
      ) {
        setSelectedChildId(
          loadedChildren[0].id
        );
      }

      setLoading(false);
    }

    loadFamily();
  }, [router]);

  /* =========================================================
     가족코드 저장
  ========================================================= */

  async function handleSaveFamilyCode(
    e: FormEvent
  ) {
    e.preventDefault();

    setMessage("");

    if (
      !/^[A-Za-z0-9]{4,12}$/.test(
        familyCode
      )
    ) {
      setMessage(
        "가족코드는 영문 또는 숫자 4~12자리입니다."
      );

      return;
    }

    const {
      error,
    } = await supabase.rpc(
      "set_family_code",
      {
        p_family_code:
          familyCode
            .trim()
            .toUpperCase(),
      }
    );

    if (error) {
      console.error(
        "가족코드 저장 오류:",
        error
      );

      setMessage(
        error.message
      );

      return;
    }

    setFamilyCode(
      familyCode
        .trim()
        .toUpperCase()
    );

    setMessage(
      "가족코드를 저장했습니다."
    );
  }

  /* =========================================================
     자녀 PIN 저장
  ========================================================= */

  async function handleSavePin(
    e: FormEvent
  ) {
    e.preventDefault();

    setMessage("");

    if (!selectedChildId) {
      setMessage(
        "자녀를 선택해주세요."
      );

      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setMessage(
        "PIN은 숫자 6자리로 입력해주세요."
      );

      return;
    }

    if (pin !== confirmPin) {
      setMessage(
        "PIN이 서로 일치하지 않습니다."
      );

      return;
    }

    setSaving(true);

    const {
      data,
      error,
    } = await supabase.rpc(
      "set_child_pin",
      {
        p_child_id:
          selectedChildId,
        p_pin: pin,
      }
    );

    setSaving(false);

    if (error) {
      console.error(
        "자녀 PIN 저장 오류:",
        error
      );

      setMessage(
        error.message
      );

      return;
    }

    const childName =
      data?.child_name ??
      children.find(
        (child) =>
          child.id ===
          selectedChildId
      )?.display_name ??
      "자녀";

    setPin("");
    setConfirmPin("");

    setMessage(
      `${childName}의 PIN을 저장했습니다.`
    );
  }

  /* =========================================================
     로딩
  ========================================================= */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          설정을 불러오는 중...
        </p>
      </main>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#F2F2F2]">
      <div className="mx-auto min-h-screen max-w-md bg-white">

        {/* 헤더 */}

        <header className="bg-[#FFD84D] px-6 pb-8 pt-12">
          <button
            type="button"
            onClick={() =>
              router.push("/admin")
            }
            className="mb-6 text-sm font-semibold"
          >
            ← 부모 모드
          </button>

          <h1 className="text-2xl font-bold">
            자녀 로그인 설정
          </h1>

          <p className="mt-2 text-sm text-[#555]">
            자녀가 사용할 가족코드와 PIN을 설정해요.
          </p>
        </header>

        <section className="space-y-7 px-6 py-8">

          {/* =================================================
              자녀 선택
          ================================================= */}

          <div>
            <h2 className="mb-3 text-lg font-bold">
              👧👦 자녀 선택
            </h2>

            {children.length === 0 ? (
              <div className="rounded-xl bg-[#F7F7F7] p-4 text-sm text-[#777]">
                등록된 자녀가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {children.map(
                  (child) => {
                    const selected =
                      child.id ===
                      selectedChildId;

                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() =>
                          setSelectedChildId(
                            child.id
                          )
                        }
                        className={`rounded-2xl border-2 p-5 text-center transition ${
                          selected
                            ? "border-[#FFD84D] bg-[#FFF9DD]"
                            : "border-[#E5E5E5] bg-white"
                        }`}
                      >
                        <div className="text-4xl">
                          {child.avatar_emoji ??
                            "👦"}
                        </div>

                        <div className="mt-2 font-bold">
                          {
                            child.display_name
                          }
                        </div>

                        {selected && (
                          <div className="mt-1 text-xs font-semibold text-[#777]">
                            선택됨 ✓
                          </div>
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* =================================================
              가족코드
          ================================================= */}

          <div>
            <h2 className="mb-3 text-lg font-bold">
              🔑 가족 코드
            </h2>

            <form
              onSubmit={
                handleSaveFamilyCode
              }
              className="space-y-3"
            >
              <input
                value={familyCode}
                onChange={(e) =>
                  setFamilyCode(
                    e.target.value
                      .replace(
                        /[^a-zA-Z0-9]/g,
                        ""
                      )
                      .toUpperCase()
                  )
                }
                maxLength={12}
                placeholder="가족코드"
                className="w-full rounded-xl border border-[#DDD] p-4 text-center text-lg font-bold uppercase tracking-[0.12em]"
              />

              <button
                type="submit"
                className="w-full rounded-xl bg-[#F3F3F3] py-3 font-bold"
              >
                가족코드 저장
              </button>
            </form>
          </div>

          {/* =================================================
              PIN
          ================================================= */}

          <div>
            <h2 className="mb-3 text-lg font-bold">
              🔐 자녀 PIN
            </h2>

            {selectedChildId && (
              <p className="mb-4 text-sm text-[#777]">
                현재 선택:
                {" "}
                <span className="font-bold text-[#333]">
                  {
                    children.find(
                      (child) =>
                        child.id ===
                        selectedChildId
                    )?.avatar_emoji ??
                    "👦"
                  }
                  {" "}
                  {
                    children.find(
                      (child) =>
                        child.id ===
                        selectedChildId
                    )?.display_name
                  }
                </span>
              </p>
            )}

            <form
              onSubmit={handleSavePin}
              className="space-y-3"
            >
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) =>
                  setPin(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                placeholder="새 PIN 6자리"
                autoComplete="off"
                className="w-full rounded-xl border border-[#DDD] p-4 text-center text-xl tracking-[0.4em]"
              />

              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                placeholder="PIN 다시 입력"
                autoComplete="off"
                className="w-full rounded-xl border border-[#DDD] p-4 text-center text-xl tracking-[0.4em]"
              />

              <button
                type="submit"
                disabled={
                  saving ||
                  !selectedChildId
                }
                className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
              >
                {saving
                  ? "저장 중..."
                  : "선택한 자녀 PIN 저장"}
              </button>
            </form>
          </div>

          {/* 메시지 */}

          {message && (
            <div className="rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          {/* 안내 */}

          <div className="rounded-xl bg-[#F7F7F7] p-4 text-sm leading-6 text-[#666]">
            💡 자녀가 자신의 기기에서
            <br />
            가족코드와 본인의 PIN을 입력하면
            해당 자녀로 로그인할 수 있어요.
          </div>

        </section>
      </div>
    </main>
  );
}