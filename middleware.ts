export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/clients/:path*", "/orders/:path*", "/products/:path*"],
};
