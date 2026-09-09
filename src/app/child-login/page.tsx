"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import {
  getEnglishKeyFromCode,
  normalizeFamilyCodeInput,
} from "@/lib/familyCode";

type AppContext = {
  role: "parent" | "child" | "none";
  is_anonymous?: boolean;
};

type Child = {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
};

export default function ChildLoginPage() {
  const router = useRouter();

  const familyCodeInputRef =
    useRef<HTMLInputElement>(null);

  const composingRef = useRef(false);

  const suppressNativeChangeRef =
    useRef(false);

  const [familyCode, setFamilyCode] =
    useState("");

  const [children, setChildren] =
    useState<Child[]>([]);

  const [selectedChildId, setSelectedChildId] =
    useState("");

  const [pin, setPin] =
    useState("");

  const [checking, setChecking] =
    useState(true);

  const [loadingChildren, setLoadingChildren] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [parentSession, setParentSession] =
    useState(false);

  const [message, setMessage] =
    useState("");

  /* =========================================================
     자동로그인 확인
  ========================================================= */

  useEffect(() => {
    async function checkAutoLogin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setChecking(false);
        return;
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_my_app_context"
      );

      if (error) {
        console.error(
          "로그인 상태 확인 오류:",
          error
        );

        setChecking(false);
        return;
      }

      const context =
        data as AppContext | null;

      if (context?.role === "child") {
        router.replace("/");
        return;
      }

      if (context?.role === "parent") {
        setParentSession(true);

        setMessage(
          "현재 이 브라우저는 부모 계정으로 로그인되어 있습니다."
        );
      }

      setChecking(false);
    }

    checkAutoLogin();
  }, [router]);

  /* =========================================================
     가족코드 키보드 처리
  ========================================================= */

  function handleFamilyCodeKeyDown(
    e: KeyboardEvent<HTMLInputElement>
  ) {
    const englishKey =
      getEnglishKeyFromCode(e.code);

    if (!englishKey) {
      return;
    }

    e.preventDefault();

    suppressNativeChangeRef.current =
      true;

    const start =
      e.currentTarget.selectionStart ??
      familyCode.length;

    const end =
      e.currentTarget.selectionEnd ??
      start;

    const nextRaw =
      familyCode.slice(0, start) +
      englishKey +
      familyCode.slice(end);

    const nextValue =
      normalizeFamilyCodeInput(
        nextRaw
      );

    setFamilyCode(nextValue);

    const nextCaret =
      Math.min(
        start + 1,
        nextValue.length
      );

    requestAnimationFrame(() => {
      familyCodeInputRef.current?.setSelectionRange(
        nextCaret,
        nextCaret
      );

      if (!composingRef.current) {
        suppressNativeChangeRef.current =
          false;
      }
    });
  }

  /* =========================================================
     일반 변경
  ========================================================= */

  function handleFamilyCodeChange(
    value: string
  ) {
    if (
      composingRef.current ||
      suppressNativeChangeRef.current
    ) {
      return;
    }

    setFamilyCode(
      normalizeFamilyCodeInput(
        value
      )
    );
  }

  /* =========================================================
     한글 IME 시작
  ========================================================= */

  function handleCompositionStart() {
    composingRef.current = true;
  }

  /* =========================================================
     한글 IME 종료
  ========================================================= */

  function handleCompositionEnd() {
    composingRef.current = false;

    requestAnimationFrame(() => {
      suppressNativeChangeRef.current =
        false;
    });
  }

  /* =========================================================
     부모 로그아웃
  ========================================================= */

  async function logoutParent() {
    const ok = window.confirm(
      "부모 계정에서 로그아웃하고 자녀 로그인으로 전환할까요?"
    );

    if (!ok) return;

    await supabase.auth.signOut();

    setParentSession(false);
    setMessage("");
  }

  /* =========================================================
     가족코드로 자녀 목록 확인
  ========================================================= */

  async function handleFindChildren() {
    if (parentSession) {
      setMessage(
        "먼저 부모 계정에서 로그아웃해주세요."
      );

      return;
    }

    const normalizedCode =
      normalizeFamilyCodeInput(
        familyCode
      );

    setFamilyCode(
      normalizedCode
    );

    if (
      !/^[A-Z0-9]{4,12}$/.test(
        normalizedCode
      )
    ) {
      setMessage(
        "가족코드는 영문 또는 숫자 4~12자리입니다."
      );

      return;
    }

    setLoadingChildren(true);
    setMessage("");

    const {
      data,
      error,
    } = await supabase.rpc(
      "get_family_children",
      {
        p_family_code:
          normalizedCode,
      }
    );

    setLoadingChildren(false);

    if (error) {
      console.error(
        "자녀 목록 확인 오류:",
        error
      );

      setChildren([]);
      setSelectedChildId("");

      setMessage(
        error.message
      );

      return;
    }

    const loadedChildren =
      (data ?? []) as Child[];

    setChildren(
      loadedChildren
    );

    if (
      loadedChildren.length === 0
    ) {
      setSelectedChildId("");

      setMessage(
        "등록된 자녀를 찾을 수 없습니다."
      );

      return;
    }

    setSelectedChildId(
      loadedChildren[0].id
    );

    setPin("");

    setMessage(
      `${loadedChildren.length}명의 자녀를 찾았습니다.`
    );
  }

  /* =========================================================
     자녀 로그인
  ========================================================= */

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    if (parentSession) {
      setMessage(
        "먼저 부모 계정에서 로그아웃해주세요."
      );

      return;
    }

    const normalizedCode =
      normalizeFamilyCodeInput(
        familyCode
      );

    setFamilyCode(
      normalizedCode
    );

    if (
      !/^[A-Z0-9]{4,12}$/.test(
        normalizedCode
      )
    ) {
      setMessage(
        "가족코드는 영문 또는 숫자 4~12자리입니다."
      );

      return;
    }

    if (!selectedChildId) {
      setMessage(
        "로그인할 자녀를 선택해주세요."
      );

      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setMessage(
        "PIN은 숫자 6자리입니다."
      );

      return;
    }

    setLoading(true);
    setMessage("");

    let {
      data: { user },
    } = await supabase.auth.getUser();

    /* 최초 자녀 로그인 */

    if (!user) {
      const {
        data,
        error,
      } =
        await supabase.auth.signInAnonymously();

      if (error) {
        setLoading(false);
        setMessage(error.message);
        return;
      }

      user = data.user;
    }

    if (!user) {
      setLoading(false);

      setMessage(
        "로그인 세션을 만들 수 없습니다."
      );

      return;
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "claim_child_session",
      {
        p_family_code:
          normalizedCode,
        p_child_id:
          selectedChildId,
        p_pin: pin,
      }
    );

    setLoading(false);

    if (error) {
      console.error(
        "자녀 로그인 오류:",
        error
      );

      setMessage(
        error.message
      );

      return;
    }

    if (data) {
      router.replace("/");
      router.refresh();
    }
  }

  /* =========================================================
     선택한 자녀 정보
  ========================================================= */

  const selectedChild =
    children.find(
      (child) =>
        child.id ===
        selectedChildId
    );

  /* =========================================================
     자동로그인 확인 중
  ========================================================= */

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          자동 로그인 확인 중...
        </p>
      </main>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#F2F2F2]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">

        {/* 헤더 */}

        <header className="bg-[#FFD84D] px-6 pb-8 pt-16">
          <h1 className="text-3xl font-bold">
            SDgram
          </h1>

          <p className="mt-2 text-sm text-[#555]">
            공부하고 포인트를 모아보자 ⭐
          </p>
        </header>

        <section className="flex flex-1 flex-col px-7 py-8">

          {/* 제목 */}

          <div className="mb-7 text-center">
            <p className="text-5xl">
              👧👦
            </p>

            <h2 className="mt-4 text-2xl font-bold">
              자녀 로그인
            </h2>

            <p className="mt-2 text-sm text-[#777]">
              자녀를 선택하고 PIN을 입력해주세요.
            </p>
          </div>

          {parentSession ? (
            <button
              type="button"
              onClick={logoutParent}
              className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold"
            >
              부모 로그아웃 후 자녀 로그인
            </button>
          ) : (
            <div className="space-y-5">

              {/* 가족코드 */}

              <div>
                <label className="mb-2 block text-sm font-bold">
                  가족 코드
                </label>

                <div className="flex gap-2">
                  <input
                    ref={
                      familyCodeInputRef
                    }
                    value={familyCode}
                    onKeyDown={
                      handleFamilyCodeKeyDown
                    }
                    onCompositionStart={
                      handleCompositionStart
                    }
                    onCompositionEnd={
                      handleCompositionEnd
                    }
                    onChange={(e) =>
                      handleFamilyCodeChange(
                        e.target.value
                      )
                    }
                    placeholder="가족코드"
                    maxLength={12}
                    inputMode="text"
                    lang="en"
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-xl border border-[#DDD] p-4 text-center text-lg font-bold uppercase tracking-[0.12em]"
                  />

                  <button
                    type="button"
                    onClick={
                      handleFindChildren
                    }
                    disabled={
                      loadingChildren
                    }
                    className="rounded-xl bg-[#F3F3F3] px-4 font-bold disabled:opacity-50"
                  >
                    {loadingChildren
                      ? "확인 중..."
                      : "자녀 확인"}
                  </button>
                </div>

                <p className="mt-2 text-center text-xs text-[#999]">
                  영문 또는 숫자 4~12자리
                </p>
              </div>

              {/* 자녀 선택 */}

              {children.length > 0 && (
                <div>
                  <label className="mb-3 block text-sm font-bold">
                    로그인할 자녀
                  </label>

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
                            onClick={() => {
                              setSelectedChildId(
                                child.id
                              );
                              setPin("");
                              setMessage("");
                            }}
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
                </div>
              )}

              {/* PIN */}

              {selectedChild && (
                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="space-y-4"
                >
                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      {selectedChild.avatar_emoji ??
                        "👦"}{" "}
                      {selectedChild.display_name}
                      의 PIN
                    </label>

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
                      placeholder="● ● ● ● ● ●"
                      autoComplete="off"
                      className="w-full rounded-xl border border-[#DDD] p-4 text-center text-xl tracking-[0.4em]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
                  >
                    {loading
                      ? "들어가는 중..."
                      : `${selectedChild.display_name} 시작`}
                  </button>
                </form>
              )}

              {/* 자녀를 아직 확인하지 않은 경우 */}

              {children.length === 0 && (
                <div className="rounded-xl bg-[#F7F7F7] p-4 text-center text-sm text-[#777]">
                  가족코드를 입력한 후
                  <br />
                  「자녀 확인」을 눌러주세요.
                </div>
              )}

            </div>
          )}

          {/* 메시지 */}

          {message && (
            <div className="mt-5 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          {/* 부모 로그인 */}

          <button
            type="button"
            onClick={() =>
              router.push("/login")
            }
            className="mt-7 text-sm text-[#777]"
          >
            👨 부모 로그인으로 가기
          </button>

        </section>
      </div>
    </main>
  );
}