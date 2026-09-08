"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppContext = {
  role: "parent" | "child" | "none";
  is_anonymous?: boolean;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSignup, setIsSignup] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    async function checkExistingLogin() {
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

      if (
        context?.role === "parent" ||
        context?.role === "child"
      ) {
        router.replace("/");
        return;
      }

      if (
        context?.is_anonymous
      ) {
        router.replace(
          "/child-login"
        );
        return;
      }

      router.replace("/setup");
    }

    checkExistingLogin();
  }, [router]);

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        const {
          data,
          error,
        } =
          await supabase.auth.signUp({
            email,
            password,
          });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "가입되었습니다. 이메일 인증 링크를 확인해주세요."
          );
        } else {
          router.replace("/setup");
        }
      } else {
        const {
          error,
        } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) throw error;

        router.replace("/");
      }
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setMessage(
          error.message
        );
      } else {
        setMessage(
          "오류가 발생했습니다."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        자동 로그인 확인 중...
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
            아빠와 딸이 함께 만드는 공부 습관
          </p>
        </header>

        <section className="flex flex-1 flex-col justify-center px-7 py-8">
          <div className="mb-8">
            <p className="text-sm text-[#888]">
              👨 아빠 계정
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              {isSignup
                ? "처음 오셨나요? 👋"
                : "다시 만나서 반가워요 👋"}
            </h2>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold">
                이메일
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
                className="w-full rounded-xl border border-[#DDD] px-4 py-4"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                비밀번호
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                minLength={6}
                required
                className="w-full rounded-xl border border-[#DDD] px-4 py-4"
              />
            </div>

            {message && (
              <div className="rounded-xl bg-[#FFF4C2] p-4 text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
            >
              {loading
                ? "처리 중..."
                : isSignup
                ? "아빠 계정 만들기"
                : "아빠 로그인"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsSignup(
                !isSignup
              );

              setMessage("");
            }}
            className="mt-5 text-sm text-[#666]"
          >
            {isSignup
              ? "이미 계정이 있어요 → 로그인"
              : "처음 사용하는 경우 → 회원가입"}
          </button>

          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#EEE]" />
            <span className="text-xs text-[#AAA]">
              또는
            </span>
            <div className="h-px flex-1 bg-[#EEE]" />
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/child-login"
              )
            }
            className="w-full rounded-xl bg-[#F3F3F3] py-4 font-bold"
          >
            👧 딸로 들어가기
          </button>
        </section>
      </div>
    </main>
  );
}