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

type FamilyCodeResult = {
  family_code: string;
};

export default function ChildLoginAdminPage() {
  const router = useRouter();

  const familyCodeInputRef =
    useRef<HTMLInputElement>(null);

  const composingRef =
    useRef(false);

  const suppressNativeChangeRef =
    useRef(false);

  const [familyCode, setFamilyCode] =
    useState("");

  const [
    savedFamilyCode,
    setSavedFamilyCode,
  ] = useState("");

  const [childName, setChildName] =
    useState("");

  const [pin, setPin] =
    useState("");

  const [
    pinConfirm,
    setPinConfirm,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    savingCode,
    setSavingCode,
  ] = useState(false);

  const [
    savingPin,
    setSavingPin,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  /* =========================================================
     초기 데이터
  ========================================================= */

  useEffect(() => {
    async function loadData() {
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
        .select("id, family_code")
        .eq(
          "owner_user_id",
          user.id
        )
        .limit(1)
        .single();

      if (
        familyError ||
        !family
      ) {
        router.replace("/setup");
        return;
      }

      const normalizedCode =
        normalizeFamilyCodeInput(
          family.family_code
        );

      setFamilyCode(
        normalizedCode
      );

      setSavedFamilyCode(
        normalizedCode
      );

      const {
        data: child,
        error: childError,
      } = await supabase
        .from("family_members")
        .select("display_name")
        .eq(
          "family_id",
          family.id
        )
        .eq("role", "child")
        .eq(
          "is_active",
          true
        )
        .limit(1)
        .single();

      if (
        childError ||
        !child
      ) {
        setChildName("딸");
      } else {
        setChildName(
          child.display_name
        );
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  /* =========================================================
     가족코드 물리 키보드 처리
  ========================================================= */

  function handleFamilyCodeKeyDown(
    e: KeyboardEvent<HTMLInputElement>
  ) {
    const englishKey =
      getEnglishKeyFromCode(
        e.code
      );

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

    setFamilyCode(
      nextValue
    );

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

  function handleCompositionStart() {
    composingRef.current =
      true;
  }

  function handleCompositionEnd() {
    composingRef.current =
      false;

    requestAnimationFrame(() => {
      suppressNativeChangeRef.current =
        false;
    });
  }

  /* =========================================================
     가족코드 변경
  ========================================================= */

  async function handleFamilyCodeSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setMessage("");

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
        "가족코드는 영문 또는 숫자 4~12자리로 입력해주세요."
      );

      return;
    }

    setSavingCode(true);

    const {
      data,
      error,
    } = await supabase.rpc(
      "set_family_code",
      {
        p_family_code:
          normalizedCode,
      }
    );

    setSavingCode(false);

    if (error) {
      setMessage(
        error.message
      );

      return;
    }

    const result =
      data as FamilyCodeResult;

    const resultCode =
      normalizeFamilyCodeInput(
        result.family_code
      );

    setFamilyCode(
      resultCode
    );

    setSavedFamilyCode(
      resultCode
    );

    setMessage(
      `가족코드를 ${resultCode}(으)로 변경했습니다. ✅`
    );
  }

  /* =========================================================
     PIN 저장
  ========================================================= */

  async function handlePinSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setMessage("");

    if (!/^\d{6}$/.test(pin)) {
      setMessage(
        "PIN은 숫자 6자리로 입력해주세요."
      );

      return;
    }

    if (pin !== pinConfirm) {
      setMessage(
        "PIN 확인 값이 서로 다릅니다."
      );

      return;
    }

    setSavingPin(true);

    const {
      error,
    } = await supabase.rpc(
      "set_child_pin",
      {
        p_pin: pin,
      }
    );

    setSavingPin(false);

    if (error) {
      setMessage(
        error.message
      );

      return;
    }

    setPin("");
    setPinConfirm("");

    setMessage(
      `${childName}의 로그인 PIN을 저장했습니다. ✅`
    );
  }

  /* =========================================================
     복사
  ========================================================= */

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(
        savedFamilyCode
      );

      setMessage(
        "가족코드를 복사했습니다. ✅"
      );
    } catch {
      setMessage(
        "가족코드를 복사하지 못했습니다."
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          딸 로그인 설정 불러오는 중...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F2F2] text-[#252525]">
      <div className="mx-auto min-h-screen max-w-md bg-[#F7F7F7]">
        <header className="flex h-16 items-center bg-[#FFD84D] px-5">
          <button
            type="button"
            onClick={() =>
              router.push("/admin")
            }
            className="mr-4 text-xl"
          >
            ←
          </button>

          <div>
            <h1 className="text-xl font-bold">
              딸 로그인 설정
            </h1>

            <p className="text-[10px] text-[#666]">
              🔐 가족코드 · PIN 관리
            </p>
          </div>
        </header>

        <section className="p-5">
          {/* 현재 정보 */}

          <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-[#777]">
              현재 딸 로그인 정보
            </p>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#FFF4C2] p-4">
              <div>
                <p className="text-xs text-[#777]">
                  가족 코드
                </p>

                <p className="mt-1 text-2xl font-black tracking-[0.12em]">
                  {savedFamilyCode}
                </p>
              </div>

              <button
                type="button"
                onClick={copyCode}
                className="rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-sm"
              >
                복사
              </button>
            </div>
          </div>

          {/* 가족코드 */}

          <form
            onSubmit={
              handleFamilyCodeSubmit
            }
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-[#777]">
              가족 코드
            </p>

            <h2 className="mt-1 text-xl font-bold">
              원하는 코드로 변경
            </h2>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-bold">
                가족코드
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
                maxLength={12}
                inputMode="text"
                lang="en"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="예: MYFAMILY"
                className="w-full rounded-xl border border-[#DDD] p-4 text-center text-lg font-bold uppercase tracking-[0.12em]"
              />

              <p className="mt-2 text-xs leading-5 text-[#888]">
                영문 또는 숫자 4~12자리
              </p>

              <p className="text-xs leading-5 text-[#888]">
                한글 입력 상태에서도 영문 키로 입력됩니다.
              </p>

              <p className="text-xs leading-5 text-[#888]">
                영문은 항상 대문자로 표시됩니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={
                savingCode ||
                familyCode ===
                  savedFamilyCode
              }
              className="mt-5 w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-40"
            >
              {savingCode
                ? "변경 중..."
                : familyCode ===
                  savedFamilyCode
                ? "현재 가족코드"
                : "가족코드 변경"}
            </button>
          </form>

          {/* PIN */}

          <form
            onSubmit={
              handlePinSubmit
            }
            className="mt-5 rounded-2xl bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-[#777]">
              {childName} 로그인
            </p>

            <h2 className="mt-1 text-xl font-bold">
              PIN 설정 🔐
            </h2>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-bold">
                숫자 6자리 PIN
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
                className="w-full rounded-xl border border-[#DDD] p-4 text-center text-xl tracking-[0.4em]"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-bold">
                PIN 확인
              </label>

              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={
                  pinConfirm
                }
                onChange={(e) =>
                  setPinConfirm(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                placeholder="● ● ● ● ● ●"
                className="w-full rounded-xl border border-[#DDD] p-4 text-center text-xl tracking-[0.4em]"
              />
            </div>

            <button
              type="submit"
              disabled={savingPin}
              className="mt-5 w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
            >
              {savingPin
                ? "저장 중..."
                : "딸 로그인 PIN 저장"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-bold">
              📱 가족코드를 변경하면?
            </p>

            <p className="mt-2 text-sm leading-6 text-[#777]">
              이미 자동로그인되어 있는 딸 기기는
              그대로 사용할 수 있습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-[#777]">
              다시 로그인할 때부터 새 가족코드를
              사용하면 됩니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}