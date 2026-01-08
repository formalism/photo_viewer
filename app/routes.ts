import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("auth/google", "routes/auth.google.tsx"),
  route("auth/google/callback", "routes/auth.google.callback.tsx"),
  route("db", "routes/db.tsx"),
  route("media", "routes/media.tsx"),
  route("thumb", "routes/thumb.tsx"),
  route("*", "routes/browse.tsx"),
] satisfies RouteConfig;
