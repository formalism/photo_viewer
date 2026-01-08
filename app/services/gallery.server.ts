import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
  ".webm",
  ".mpeg",
  ".mpg",
  ".wmv",
  ".flv",
]);

export function isImageFile(fileName: string) {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export function isVideoFile(fileName: string) {
  return VIDEO_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export function isSupportedMedia(fileName: string) {
  return isImageFile(fileName) || isVideoFile(fileName);
}

export async function listDirectoryEntries(directoryPath: string) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries.filter(
    (entry) => entry.name !== ".thumbs" && !entry.isSymbolicLink()
  );
}

export async function ensureThumbnail(
  originalPath: string,
  kind: "image" | "video"
) {
  const originalName = path.basename(originalPath);
  const directory = path.dirname(originalPath);
  const thumbsDir = path.join(directory, ".thumbs");
  const thumbName =
    kind === "video"
      ? `${path.parse(originalName).name}.jpg`
      : originalName;
  const thumbPath = path.join(thumbsDir, thumbName);

  try {
    await fs.access(thumbPath);
    return thumbPath;
  } catch {
    await fs.mkdir(thumbsDir, { recursive: true });
  }

  if (kind === "image") {
    await sharp(originalPath).resize({ width: 320 }).toFile(thumbPath);
    return thumbPath;
  }

  await createVideoThumbnail(originalPath, thumbPath);
  return thumbPath;
}

async function createVideoThumbnail(inputPath: string, outputPath: string) {
  const baseArgs = [
    "-y",
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ];

  try {
    await runFfmpeg(["-ss", "2", ...baseArgs]);
  } catch {
    await runFfmpeg(baseArgs);
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile("ffmpeg", args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function ensureWithinRoot(root: string, target: string) {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  if (
    normalizedTarget !== normalizedRoot &&
    !normalizedTarget.startsWith(normalizedRoot + path.sep)
  ) {
    throw new Error("Path escapes the mapped directory");
  }
  return normalizedTarget;
}

export function normalizeRelativePath(rawPath: string) {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes("\\")) {
    throw new Error("Invalid path");
  }
  const normalized = path.posix.normalize(trimmed);
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("..")) {
    throw new Error("Invalid path");
  }
  return normalized;
}
