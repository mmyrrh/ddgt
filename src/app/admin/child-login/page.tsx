"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ChildLoginAdminPage() {
  const router = useRouter();

  const [familyCode, setFamilyCode] = useState("");
  const [childName, setChildName] = useState("");

  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
        .eq("owner_user_id", user.id)
        .limit(1)
        .single();

      if (familyError || !family) {
        router.replace("/setup");
        return;
      }

      setFamilyCode(family.family_code);

      const {
        data: child,
      } = await supabase
        .from("family_members")
        .select("display_name")
        .eq("family_id", family.id)
        .eq("role", "child")
        .eq("is_active", true)
        .limit(1)
        .single();

      setChildName(
        child?.display_name ?? "딸"
      );

      setLoading(false);
    }

    loadData();
  }, [router]);

  async function handleSubmit(
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

    setSaving(true);

    const {
      error,
    } = await supabase.rpc(
      "set_child_pin",
      {
        p_pin: pin,
      }
    );

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPin("");
    setPinConfirm("");

    setMessage(
      `${childName}의 로그인 PIN을 저장했습니다. ✅`
    );
  }

  async function copyCode() {
    await navigator.clipboard.writeText(
      familyCode
    );

    setMessage(
      "가족 코드를 복사했습니다. ✅"
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        불러오는 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F2F2] text-[#252525]">
      <div className="mx-auto min-h-screen max-w-md bg-[#F7F7F7]">
        <header className="flex h-16 items-center bg-[#FFD84D] px-5">
          <button
            onClick={() =>
              router.push("/admin")
            }
            className="mr-4 text-xl"
          >
            ←
          </button>

          <h1 className="text-xl font-bold">
            딸 로그인 설정
          </h1>
        </header>

        <section className="p-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-[#777]">
              딸 최초 로그인용 가족 코드
            </p>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FFF4C2] p-4">
              <p className="text-2xl font-black tracking-[0.15em]">
                {familyCode}
              </p>

              <button
                type="button"
                onClick={copyCode}
                className="rounded-lg bg-white px-3 py-2 text-sm font-bold"
              >
                복사
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-[#777]">
              이 가족 코드는 딸 기기에서
              처음 로그인할 때만 사용합니다.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-5 rounded-2xl bg-white p-5 shadow-sm"
          >
            <h2 className="text-xl font-bold">
              {childName} PIN 설정 🔐
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
                value={pinConfirm}
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
              disabled={saving}
              className="mt-5 w-full rounded-xl bg-[#FFD84D] py-4 font-bold disabled:opacity-50"
            >
              {saving
                ? "저장 중..."
                : "딸 로그인 PIN 저장"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-xl bg-[#FFF4C2] p-4 text-sm">
              {message}
            </div>
          )}

          <div className="mt-5 rounded-2xl bg-white p-5 text-sm leading-6 shadow-sm">
            <p className="font-bold">
              📱 딸 로그인 방법
            </p>

            <p className="mt-2 text-[#777]">
              딸 기기에서 `/child-login`에 접속해
              가족 코드와 PIN을 한 번 입력합니다.
              이후 같은 기기에서는 자동으로 로그인됩니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}