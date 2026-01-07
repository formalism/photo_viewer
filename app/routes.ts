import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("auth/google", "routes/auth/google.ts"),
  route("auth/google/callback", "routes/auth/callback.ts"),
  route("db", "routes/db.tsx"),
  route("*?", "routes/viewer.tsx"),
] satisfies RouteConfig;