import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import type { NextAuthRequest } from "next-auth";

const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/login", "/register", "/verify"];

export const proxy = auth((request: NextAuthRequest) => {
  const isLoggedIn = !!request.auth?.user;
  const isAuthPage = AUTH_PAGES.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  // Skip API routes, static assets, the service worker, and files with extensions.
  matcher: ["/((?!api|_next|sw\\.js|manifest\\.webmanifest|~offline|.*\\..*).*)"],
};
