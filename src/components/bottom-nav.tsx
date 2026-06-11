"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CarFront, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const items = [
    { href: "/", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/cars", label: t("garage"), icon: CarFront },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-primary/10",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
