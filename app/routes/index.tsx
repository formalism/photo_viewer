import { Link } from "react-router";
import type { Route } from "./+types/index";
import { requireAuthorizedUser } from "~/services/auth.server";
import { countUsers, getUserByEmail, listMappingsForUser } from "~/db/queries.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuthorizedUser(request);
  const userCount = await countUsers();
  const dbUser = await getUserByEmail(user.email);
  const mappings = dbUser ? await listMappingsForUser(dbUser.id) : [];

  return {
    email: user.email,
    mappings,
    userCount,
    isRegistered: Boolean(dbUser),
  };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { email, mappings, userCount, isRegistered } = loaderData;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">
            Photo Viewer
          </p>
          <h1 className="text-3xl font-semibold">Welcome, {email}</h1>
        </header>
        {!isRegistered && userCount > 0 ? (
          <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6">
            <h2 className="text-lg font-semibold text-amber-100">
              このアカウントは登録されていません
            </h2>
            <p className="mt-2 text-sm text-amber-200/90">
              管理者に登録を依頼してください。
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">利用可能なディレクトリ</h2>
            {mappings.length === 0 ? (
              <p className="mt-3 text-sm text-slate-300">
                まだディレクトリが設定されていません。
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {mappings.map((mapping) => (
                  <li key={mapping.id}>
                    <Link
                      to={mapping.urlPath}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
                    >
                      <span className="text-slate-400">{mapping.urlPath}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-slate-200">{mapping.directory}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/db"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            アカウント管理
          </Link>
          <form method="post" action="/logout">
            <button
              type="submit"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
