import { Form } from "react-router";
import type { Route } from "./+types/db";
import {
  countUsers,
  createMapping,
  createUser,
  deleteMapping,
  deleteUser,
  getUserByEmail,
  listMappings,
  listUsers,
} from "~/db/queries.server";
import { requireAuthorizedUser } from "~/services/auth.server";
import { isReservedPath, normalizeUrlPath } from "~/utils/url-path.server";
import fs from "node:fs/promises";
import path from "node:path";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuthorizedUser(request);
  const [users, mappings, userCount, dbUser] = await Promise.all([
    listUsers(),
    listMappings(),
    countUsers(),
    getUserByEmail(user.email),
  ]);

  return {
    currentEmail: user.email,
    isRegistered: Boolean(dbUser) || userCount === 0,
    userCount,
    users,
    mappings,
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuthorizedUser(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");

  if (actionType === "add-user") {
    const email = String(formData.get("email") || "").trim();
    if (!email) {
      throw new Response("Email is required", { status: 400 });
    }
    await createUser(email);
    return { ok: true };
  }

  if (actionType === "delete-user") {
    const userId = Number(formData.get("userId"));
    if (!Number.isInteger(userId)) {
      throw new Response("Invalid user", { status: 400 });
    }
    await deleteUser(userId);
    return { ok: true };
  }

  if (actionType === "add-mapping") {
    const userId = Number(formData.get("userId"));
    const rawPath = String(formData.get("urlPath") || "");
    const directory = String(formData.get("directory") || "").trim();

    if (!Number.isInteger(userId)) {
      throw new Response("User is required", { status: 400 });
    }

    if (!directory) {
      throw new Response("Directory is required", { status: 400 });
    }

    const normalizedPath = normalizeUrlPath(rawPath);
    if (isReservedPath(normalizedPath)) {
      throw new Response("/db is reserved", { status: 400 });
    }

    const resolvedDir = path.resolve(directory);
    const stat = await fs.lstat(resolvedDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Response("Directory must be a real directory", {
        status: 400,
      });
    }

    await createMapping({
      userId,
      urlPath: normalizedPath,
      directory: resolvedDir,
    });
    return { ok: true };
  }

  if (actionType === "delete-mapping") {
    const mappingId = Number(formData.get("mappingId"));
    if (!Number.isInteger(mappingId)) {
      throw new Response("Invalid mapping", { status: 400 });
    }
    await deleteMapping(mappingId);
    return { ok: true };
  }

  throw new Response("Unsupported action", { status: 400 });
}

export default function DbAdmin({ loaderData }: Route.ComponentProps) {
  const { currentEmail, isRegistered, userCount, users, mappings } =
    loaderData;
  const mappingsByUser = new Map<number, typeof mappings>();

  mappings.forEach((mapping) => {
    const list = mappingsByUser.get(mapping.userId) ?? [];
    list.push(mapping);
    mappingsByUser.set(mapping.userId, list);
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">
            Photo Viewer
          </p>
          <h1 className="text-3xl font-semibold">アカウント管理</h1>
          <p className="text-sm text-slate-400">ログイン: {currentEmail}</p>
        </header>

        {userCount === 0 && (
          <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4 text-sm text-sky-100">
            初期状態のため、ログイン済みユーザは誰でも管理画面を利用できます。
          </div>
        )}

        {!isRegistered && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            現在のアカウントは登録されていません。
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">利用者</h2>
          <Form method="post" className="mt-4 flex flex-wrap gap-3">
            <input
              name="email"
              type="email"
              placeholder="user@example.com"
              required
              className="min-w-[260px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <button
              name="_action"
              value="add-user"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
            >
              追加
            </button>
          </Form>
          <ul className="mt-4 space-y-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm"
              >
                <span>{user.email}</span>
                <Form method="post">
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    name="_action"
                    value="delete-user"
                    className="text-xs text-rose-300 hover:text-rose-200"
                  >
                    削除
                  </button>
                </Form>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">パスとディレクトリの対応</h2>
          <Form method="post" className="mt-4 grid gap-3 md:grid-cols-4">
            <select
              name="userId"
              required
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">ユーザを選択</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
            <input
              name="urlPath"
              type="text"
              placeholder="/photos"
              required
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <input
              name="directory"
              type="text"
              placeholder="/mnt/photos"
              required
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <button
              name="_action"
              value="add-mapping"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
            >
              追加
            </button>
          </Form>

          <div className="mt-6 space-y-4">
            {users.map((user) => (
              <div key={user.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">
                  {user.email}
                </h3>
                <ul className="space-y-2">
                  {(mappingsByUser.get(user.id) ?? []).map((mapping) => (
                    <li
                      key={mapping.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-200">
                        {mapping.urlPath} → {mapping.directory}
                      </span>
                      <Form method="post">
                        <input
                          type="hidden"
                          name="mappingId"
                          value={mapping.id}
                        />
                        <button
                          name="_action"
                          value="delete-mapping"
                          className="text-xs text-rose-300 hover:text-rose-200"
                        >
                          削除
                        </button>
                      </Form>
                    </li>
                  ))}
                  {(mappingsByUser.get(user.id) ?? []).length === 0 && (
                    <li className="text-xs text-slate-500">
                      マッピングがありません。
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
