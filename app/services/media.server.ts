import fs from "node:fs";
import { stat } from "node:fs/promises";
import { createReadableStreamFromReadable } from "@react-router/node";
import { lookup } from "mime-types";

export async function createFileResponse(
  filePath: string,
  request?: Request
) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error("Not a file");
  }
  const contentType = lookup(filePath) || "application/octet-stream";
  const fileSize = fileStat.size;

  const rangeHeader = request?.headers.get("Range");
  if (rangeHeader) {
    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(createReadableStreamFromReadable(stream), {
        status: 206,
        headers: {
          "Content-Type": contentType.toString(),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunkSize.toString(),
          "Accept-Ranges": "bytes",
        },
      });
    }
  }

  const stream = fs.createReadStream(filePath);
  return new Response(createReadableStreamFromReadable(stream), {
    headers: {
      "Content-Type": contentType.toString(),
      "Content-Length": fileSize.toString(),
      "Accept-Ranges": "bytes",
    },
  });
}
