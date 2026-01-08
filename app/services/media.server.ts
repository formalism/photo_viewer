import fs from "node:fs";
import { stat } from "node:fs/promises";
import { createReadableStreamFromReadable } from "@react-router/node";
import { lookup } from "mime-types";

export async function createFileResponse(filePath: string) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error("Not a file");
  }
  const contentType = lookup(filePath) || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  return new Response(createReadableStreamFromReadable(stream), {
    headers: {
      "Content-Type": contentType.toString(),
      "Content-Length": fileStat.size.toString(),
    },
  });
}
