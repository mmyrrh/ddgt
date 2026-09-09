"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SetupPage() {
  const router = useRouter();

  const [familyName, setFamilyName] = useState("우리 가족");
  const [parentName, setParentName] = useState("아빠");
  const [childName, setChildName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkLogin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("families")
        .select("id")
        .limit(1);

      if (data && data.length > 0) {
        router.replace("/");
        return;
      }

      setLoading(false);
    }

    checkLogin();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("create_initial_family", {
      p_family_name: familyName,
      p_parent_name: parentName,
      p_child_name: childName,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>확인 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F2F2]">
      <div className="mx-auto min-h-screen max-w-md bg-white">
        <header className="bg-[#FFD84D] px-6 pb-8 pt-16">
          <h1 className="text-3xl font-bold">SDgram</h1>
          <p className="mt-2 text-[#555]">
            우리 가족을 등록해주세요
          </p>
        </header>

        <section className="px-7 py-10">
          <div className="mb-8">
            <p className="text-sm text-[#888]">
              처음 한 번만 설정하면 됩니다.
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              가족 만들기 👨‍👧
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block font-bold">
                가족 이름
              </label>

              <input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full rounded-xl border border-[#DDD] p-4 outline-none focus:border-[#FFD84D]"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold">
                부모 이름
              </label>

              <input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="예: 아빠, 엄마"
                required
                className="w-full rounded-xl border border-[#DDD] p-4 outline-none focus:border-[#FFD84D]"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold">
                딸 이름
              </label>

              <input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="딸 이름 또는 별명"
                required
                className="w-full rounded-xl border border-[#DDD] p-4 outline-none focus:border-[#FFD84D]"
              />
            </div>

            {message && (
              <div className="rounded-xl bg-[#FFF4C2] p-4 text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
            >
              {saving ? "만드는 중..." : "우리 가족 시작하기"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}