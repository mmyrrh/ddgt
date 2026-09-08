"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "가입되었습니다. 이메일로 받은 인증 링크를 확인해주세요."
          );
        } else {
          router.push("/setup");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/setup");
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F2F2F2]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
        <header className="bg-[#FFD84D] px-6 pb-8 pt-16">
          <h1 className="text-3xl font-bold text-[#252525]">
            딸천재톡
          </h1>

          <p className="mt-2 text-sm text-[#555]">
            아빠와 딸이 함께 만드는 공부 습관
          </p>
        </header>

        <section className="flex flex-1 flex-col justify-center px-7">
          <div className="mb-8">
            <p className="text-sm text-[#888]">아빠 계정</p>

            <h2 className="mt-1 text-2xl font-bold">
              {isSignup ? "처음 오셨나요? 👋" : "다시 만나서 반가워요 👋"}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                이메일
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full rounded-xl border border-[#DDDDDD] px-4 py-4 outline-none focus:border-[#FFD84D]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                비밀번호
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상 입력"
                minLength={6}
                required
                className="w-full rounded-xl border border-[#DDDDDD] px-4 py-4 outline-none focus:border-[#FFD84D]"
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
                : "로그인"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setMessage("");
            }}
            className="mt-6 text-sm text-[#666]"
          >
            {isSignup
              ? "이미 계정이 있어요 → 로그인"
              : "처음 사용하는 경우 → 회원가입"}
          </button>
        </section>

        <footer className="px-6 pb-8 text-center text-xs text-[#999]">
          딸의 계정은 아빠가 로그인한 후 만들 수 있습니다.
        </footer>
      </div>
    </main>
  );
}