export function normalizeUrlPath(rawPath: string) {
  let normalized = rawPath.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\/+/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function isReservedPath(pathname: string) {
  return pathname === "/db" || pathname.startsWith("/db/");
}
