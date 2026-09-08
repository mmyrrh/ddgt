"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppContext = {
  role: "parent" | "child" | "none";
  is_anonymous?: boolean;
};

export default function ChildLoginPage() {
  const router = useRouter();

  const [familyCode, setFamilyCode] = useState("");
  const [pin, setPin] = useState("");

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  const [parentSession, setParentSession] =
    useState(false);

  const [message, setMessage] = useState("");

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
      } = await supabase.rpc(
        "get_my_app_context"
      );

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

  async function logoutParent() {
    const ok = window.confirm(
      "아빠 계정에서 로그아웃하고 딸 로그인으로 전환할까요?"
    );

    if (!ok) return;

    await supabase.auth.signOut();

    setParentSession(false);
    setMessage("");
  }

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

    if (!familyCode.trim()) {
      setMessage(
        "가족 코드를 입력해주세요."
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

    /* 처음 접속한 딸 기기라면
       익명 Auth 계정 생성 */

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
          familyCode
            .trim()
            .toUpperCase(),
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

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          자동 로그인 확인 중...
        </p>
      </main>
    );
  }

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
              <div>
                <label className="mb-2 block text-sm font-bold">
                  가족 코드
                </label>

                <input
                  value={familyCode}
                  onChange={(e) =>
                    setFamilyCode(
                      e.target.value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9]/g,
                          ""
                        )
                    )
                  }
                  placeholder="예: A1B2C3D4"
                  maxLength={8}
                  autoCapitalize="characters"
                  className="w-full rounded-xl border border-[#DDD] p-4 text-center text-lg font-bold uppercase tracking-[0.15em]"
                />
              </div>

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