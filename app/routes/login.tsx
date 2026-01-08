import { Link } from "react-router";
import type { Route } from "./+types/login";
import { authenticator } from "~/services/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  await authenticator.isAuthenticated(request, {
    successRedirect: "/",
  });
  return {
    error: new URL(request.url).searchParams.get("error"),
  };
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const { error } = loaderData;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-16">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">
            Photo Viewer
          </p>
          <h1 className="text-3xl font-semibold">ログイン</h1>
        </header>
        {error === "unauthorized" && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            このアカウントは許可されていません。管理者に登録を依頼してください。
          </div>
        )}
        <Link
          to="/auth/google"
          className="inline-flex w-fit items-center gap-3 rounded-full border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 hover:border-slate-500"
        >
          Googleでログイン
        </Link>
        <p className="text-xs text-slate-500">
          Google OAuth2で認証します。
        </p>
      </div>
    </main>
  );
}
