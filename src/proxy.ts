import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/register"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));
  const isAuthPage = AUTH_PAGES.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, static assets, the service worker, and files with extensions.
  matcher: ["/((?!api|_next|sw\\.js|manifest\\.webmanifest|~offline|.*\\..*).*)"],
};
