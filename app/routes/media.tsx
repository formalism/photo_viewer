import type { Route } from "./+types/media";
import path from "node:path";
import fs from "node:fs/promises";
import { requireAuthorizedUser } from "~/services/auth.server";
import { getMappingByUserAndPath, getUserByEmail } from "~/db/queries.server";
import {
  ensureWithinRoot,
  isSupportedMedia,
  normalizeRelativePath,
} from "~/services/gallery.server";
import { createFileResponse } from "~/services/media.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuthorizedUser(request);
  const url = new URL(request.url);
  const base = url.searchParams.get("base");
  const relative = url.searchParams.get("path");

  if (!base || relative === null) {
    throw new Response("Missing params", { status: 400 });
  }

  const dbUser = await getUserByEmail(user.email);
  if (!dbUser) {
    throw new Response("Not authorized", { status: 403 });
  }

  const mapping = await getMappingByUserAndPath(dbUser.id, base);
  if (!mapping) {
    throw new Response("Not found", { status: 404 });
  }

  const safeRelative = normalizeRelativePath(relative);
  const resolvedPath = ensureWithinRoot(
    mapping.directory,
    path.resolve(mapping.directory, safeRelative)
  );
  if (!isSupportedMedia(resolvedPath)) {
    throw new Response("Unsupported media", { status: 400 });
  }
  const stat = await fs.lstat(resolvedPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Response("Not found", { status: 404 });
  }

  return createFileResponse(resolvedPath);
}
