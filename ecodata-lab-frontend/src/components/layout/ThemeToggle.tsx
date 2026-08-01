"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="shrink-0"
    >
      {mounted ? (
        isDark ? (
          <SunIcon size={20} weight="bold" aria-hidden="true" />
        ) : (
          <MoonIcon size={20} weight="bold" aria-hidden="true" />
        )
      ) : (
        <span className="size-5" aria-hidden="true" />
      )}
    </Button>
  );
}
