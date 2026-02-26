import { Link } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/browse";
import path from "node:path";
import fs from "node:fs/promises";
import { requireAuthorizedUser } from "~/services/auth.server";
import {
  type DbMapping,
  getUserByEmail,
  listMappingsForUser,
} from "~/db/queries.server";
import {
  ensureThumbnail,
  ensureWithinRoot,
  isVideoFile,
  isSupportedMedia,
  listDirectoryEntries,
  normalizeRelativePath,
} from "~/services/gallery.server";

function matchMapping(pathname: string, mappings: Array<DbMapping>) {
  let best: DbMapping | null = null;
  for (const mapping of mappings) {
    if (pathname === mapping.urlPath) {
      if (!best || mapping.urlPath.length > best.urlPath.length) {
        best = mapping;
      }
      continue;
    }
    if (pathname.startsWith(mapping.urlPath + "/")) {
      if (!best || mapping.urlPath.length > best.urlPath.length) {
        best = mapping;
      }
    }
  }
  return best;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuthorizedUser(request);
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);
  const dbUser = await getUserByEmail(user.email);

  if (!dbUser) {
    return {
      email: user.email,
      mappings: [],
      notFound: true,
      message: "ディレクトリの設定がありません。",
      basePath: "",
      currentPath: "",
      relativePath: "",
      folders: [],
      files: [],
      parentPath: null,
    };
  }

  const mappings = await listMappingsForUser(dbUser.id);
  const matched = matchMapping(pathname, mappings);

  if (!matched) {
    return {
      email: user.email,
      mappings,
      notFound: true,
      message: "対応するディレクトリが見つかりませんでした。",
      basePath: "",
      currentPath: "",
      relativePath: "",
      folders: [],
      files: [],
      parentPath: null,
    };
  }

  const suffix =
    pathname === matched.urlPath
      ? ""
      : matched.urlPath === "/"
        ? pathname.slice(1)
        : pathname.slice(matched.urlPath.length + 1);
  const relativePath = normalizeRelativePath(suffix);
  const diskPath = ensureWithinRoot(
    matched.directory,
    path.resolve(matched.directory, relativePath)
  );
  const stat = await fs.lstat(diskPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Response("Not found", { status: 404 });
  }

  const entries = await listDirectoryEntries(diskPath);
  const folders = [] as Array<{ name: string; urlPath: string }>;
  const files = [] as Array<{
    name: string;
    kind: "image" | "video";
    urlPath: string;
    thumbUrl: string;
    fileUrl: string;
  }>;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const folderPath = path.posix.join(
        matched.urlPath,
        relativePath,
        entry.name
      );
      folders.push({ name: entry.name, urlPath: folderPath });
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!isSupportedMedia(entry.name)) {
      continue;
    }
    const kind = isVideoFile(entry.name) ? "video" : "image";
    const relativeFilePath = path.posix.join(relativePath, entry.name);
    const fullPath = path.join(diskPath, entry.name);
    await ensureThumbnail(fullPath, kind);
    const encodedBase = encodeURIComponent(matched.urlPath);
    const encodedPath = encodeURIComponent(relativeFilePath);
    files.push({
      name: entry.name,
      kind,
      urlPath: relativeFilePath,
      thumbUrl: `/thumb?base=${encodedBase}&path=${encodedPath}`,
      fileUrl: `/media?base=${encodedBase}&path=${encodedPath}`,
    });
  }

  const parentPath = relativePath
    ? path.posix.join(matched.urlPath, path.posix.dirname(relativePath))
    : null;

  return {
    email: user.email,
    mappings,
    notFound: false,
    basePath: matched.urlPath,
    currentPath: pathname,
    relativePath,
    folders,
    files,
    parentPath: parentPath === matched.urlPath ? matched.urlPath : parentPath,
  };
}

import { MediaViewer } from "~/components/media-viewer";

/* ------------------------------------------------------------------ */
/*  Browse page                                                        */
/* ------------------------------------------------------------------ */

export default function Browse({ loaderData }: Route.ComponentProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (loaderData.notFound) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16">
          <h1 className="text-2xl font-semibold">ディレクトリが見つかりません</h1>
          <p className="text-sm text-slate-400">{loaderData.message}</p>
          {loaderData.mappings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">利用可能なパス</p>
              <ul className="space-y-2">
                {loaderData.mappings.map((mapping) => (
                  <li key={mapping.id}>
                    <Link
                      to={mapping.urlPath}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                      {mapping.urlPath}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link
            to="/db"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            アカウント管理
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              {loaderData.basePath}
            </p>
            <h1 className="text-2xl font-semibold">{loaderData.currentPath}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              ホーム
            </Link>
            <Link
              to="/db"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              管理
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
        </header>

        {loaderData.parentPath && (
          <Link
            to={loaderData.parentPath}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ← 親ディレクトリへ戻る
          </Link>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">フォルダ</h2>
          {loaderData.folders.length === 0 ? (
            <p className="text-sm text-slate-500">フォルダはありません。</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loaderData.folders.map((folder) => (
                <Link
                  key={folder.urlPath}
                  to={folder.urlPath}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm hover:border-slate-600"
                >
                  <span className="text-xl">📁</span>
                  <span>{folder.name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">メディア</h2>
          {loaderData.files.length === 0 ? (
            <p className="text-sm text-slate-500">メディアはありません。</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {loaderData.files.map((file, index) => (
                <button
                  key={file.urlPath}
                  type="button"
                  onClick={() => setViewerIndex(index)}
                  className="group flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-left hover:border-slate-600"
                >
                  <div className="relative overflow-hidden rounded-xl bg-slate-950">
                    <img
                      src={file.thumbUrl}
                      alt={file.name}
                      className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    {file.kind === "video" && (
                      <span className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-100">
                        Video
                      </span>
                    )}
                  </div>
                  <span className="truncate text-sm text-slate-200">
                    {file.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {viewerIndex !== null && (
        <MediaViewer
          files={loaderData.files}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      )}
    </main>
  );
}
