"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppContext = {
  role: "parent" | "child" | "none";
};

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function checkParent() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_my_app_context"
      );

      if (error) {
        router.replace("/");
        return;
      }

      const context =
        data as AppContext;

      if (context.role !== "parent") {
        router.replace("/");
        return;
      }

      setAllowed(true);
    }

    checkParent();
  }, [router]);

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="font-semibold">
          권한 확인 중...
        </p>
      </main>
    );
  }

  return <>{children}</>;
}