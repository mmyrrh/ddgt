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

export default function ChildLoginPage() {
  const router = useRouter();

  const familyCodeInputRef =
    useRef<HTMLInputElement>(null);

  const composingRef = useRef(false);

  const suppressNativeChangeRef =
    useRef(false);

  const [familyCode, setFamilyCode] =
    useState("");

  const [pin, setPin] =
    useState("");

  const [checking, setChecking] =
    useState(true);

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
          "현재 이 브라우저는 아빠 계정으로 로그인되어 있습니다."
        );
      }

      setChecking(false);
    }

    checkAutoLogin();
  }, [router]);

  /* =========================================================
     가족코드 키보드 처리

     한글 입력 상태:
     ㅇ 키 1번 = D 1개

     영문 입력 상태:
     d / D 모두 D 1개
  ========================================================= */

  function handleFamilyCodeKeyDown(
    e: KeyboardEvent<HTMLInputElement>
  ) {
    const englishKey =
      getEnglishKeyFromCode(e.code);

    if (!englishKey) {
      return;
    }

    /*
      브라우저/IME가 실제 한글 문자를
      입력하는 것은 막고 우리가 물리키를
      영문으로 한 번만 입력한다.
    */
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

      /*
        일반 영문 입력이었다면
        composition이 없으므로 여기서 해제.
      */
      if (!composingRef.current) {
        suppressNativeChangeRef.current =
          false;
      }
    });
  }

  /* =========================================================
     일반 변경
     Backspace / Delete / 붙여넣기 등
  ========================================================= */

  function handleFamilyCodeChange(
    value: string
  ) {
    /*
      이미 keyDown에서 처리한 IME 입력은
      다시 처리하지 않는다.
    */
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

     중요:
     여기서 ㅇ -> D 변환을 다시 하지 않는다.
     이미 KeyDown에서 D를 넣었기 때문.
  ========================================================= */

  function handleCompositionEnd() {
    composingRef.current = false;

    requestAnimationFrame(() => {
      suppressNativeChangeRef.current =
        false;
    });
  }

  /* =========================================================
     아빠 로그아웃
  ========================================================= */

  async function logoutParent() {
    const ok = window.confirm(
      "아빠 계정에서 로그아웃하고 딸 로그인으로 전환할까요?"
    );

    if (!ok) return;

    await supabase.auth.signOut();

    setParentSession(false);
    setMessage("");
  }

  /* =========================================================
     딸 로그인
  ========================================================= */

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    if (parentSession) {
      setMessage(
        "먼저 아빠 계정에서 로그아웃해주세요."
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

    /* 최초 딸 로그인 */

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
        p_pin: pin,
      }
    );

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data) {
      router.replace("/");
      router.refresh();
    }
  }

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
        <header className="bg-[#FFD84D] px-6 pb-8 pt-16">
          <h1 className="text-3xl font-bold">
            딸천재톡
          </h1>

          <p className="mt-2 text-sm text-[#555]">
            공부하고 포인트를 모아보자 ⭐
          </p>
        </header>

        <section className="flex flex-1 flex-col justify-center px-7 py-8">
          <div className="mb-7 text-center">
            <p className="text-5xl">
              👧
            </p>

            <h2 className="mt-4 text-2xl font-bold">
              딸 로그인
            </h2>

            <p className="mt-2 text-sm text-[#777]">
              처음 한 번만 입력하면
              다음부터 자동으로 들어가요.
            </p>
          </div>

          {parentSession ? (
            <button
              type="button"
              onClick={logoutParent}
              className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold"
            >
              아빠 로그아웃 후 딸 로그인
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* 가족코드 */}

              <div>
                <label className="mb-2 block text-sm font-bold">
                  가족 코드
                </label>

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
                  className="w-full rounded-xl border border-[#DDD] p-4 text-center text-lg font-bold uppercase tracking-[0.12em]"
                />

                <p className="mt-2 text-center text-xs text-[#999]">
                  영문 또는 숫자 4~12자리
                </p>
              </div>

              {/* PIN */}

              <div>
                <label className="mb-2 block text-sm font-bold">
                  PIN
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
                  : "딸천재톡 시작"}
              </button>
            </form>
          )}

          {message && (
            <div className="mt-5 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              router.push("/login")
            }
            className="mt-7 text-sm text-[#777]"
          >
            👨 아빠 로그인으로 가기
          </button>
        </section>
      </div>
    </main>
  );
}