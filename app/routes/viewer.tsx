import { useLoaderData, redirect, Link } from "react-router";
import { getAuthenticatedUser } from "~/auth.server";
import { findMappingForPath, isUserAllowed } from "~/db.server";
import { listDirectory, ensureThumbnail, getFileStats } from "~/utils/fs.server";
import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";
import type { Route } from "./+types/viewer";

export async function loader({ request, params }: Route.LoaderArgs) {
    const user = await getAuthenticatedUser(request);
    
    // Strict auth check: User must be logged in AND allowed.
    // Spec: "Unauthenticated users cannot use".
    if (!user || !isUserAllowed(user.email)) {
         return redirect("/auth/google");
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    
    const mapping = findMappingForPath(user.email, pathname);
    
    if (!mapping) {
        throw new Response("Not Found", { status: 404 });
    }

    const mapUrl = mapping.urlPath.startsWith('/') ? mapping.urlPath : '/' + mapping.urlPath;
    let relative = pathname.slice(mapUrl.length);
    // Remove leading slash to avoid path.join ignoring the base directory
    if (relative.startsWith('/')) relative = relative.slice(1);

    const decodedRelative = decodeURIComponent(relative);
    
    if (decodedRelative.includes('..')) {
         throw new Response("Forbidden", { status: 403 });
    }

    const absPath = path.join(mapping.directory, decodedRelative);
    
    if (!absPath.startsWith(mapping.directory)) {
         throw new Response("Forbidden", { status: 403 });
    }

    const stats = await getFileStats(absPath);
    
    const isThumbRequest = decodedRelative.split('/').some(p => p === '.thumbs');
    
    if (!stats) {
        if (isThumbRequest) {
             const dir = path.dirname(absPath);
             const filename = path.basename(absPath);
             const parentDir = path.dirname(dir); 
             
             let sourcePath = path.join(parentDir, filename);
             let sourceExists = fs.existsSync(sourcePath);
             let isVideoSource = false;

             if (!sourceExists) {
                 if (path.extname(filename).toLowerCase() === '.jpg') {
                     const nameNoExt = path.parse(filename).name;
                     const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
                     for (const ext of videoExts) {
                         const candidate = path.join(parentDir, nameNoExt + ext);
                         if (fs.existsSync(candidate)) {
                             sourcePath = candidate;
                             sourceExists = true;
                             isVideoSource = true;
                             break;
                         }
                     }
                 }
             }
             
             if (sourceExists) {
                 await ensureThumbnail(sourcePath, absPath, isVideoSource);
                 const newStats = await getFileStats(absPath);
                 if (newStats) {
                     const stream = fs.createReadStream(absPath);
                     return new Response(stream as any, {
                         headers: {
                             "Content-Type": mime.lookup(absPath) || "application/octet-stream",
                             "Cache-Control": "public, max-age=31536000",
                         }
                     });
                 } else {
                    throw new Response("Not Found", { status: 404 });
                 }
             }
        }
        
        throw new Response("Not Found", { status: 404 });
    }

    if (stats.isDirectory()) {
        const files = await listDirectory(absPath);
        return { files, pathname };
    } else {
         const stream = fs.createReadStream(absPath);
         return new Response(stream as any, {
             headers: {
                 "Content-Type": mime.lookup(absPath) || "application/octet-stream",
             }
         });
    }
}

export default function Viewer() {
    const data = useLoaderData<typeof loader>();
    const files = data?.files ?? [];
    const pathname = data?.pathname ?? '/';
    
    const join = (base: string, part: string) => {
        return base.endsWith('/') ? base + part : base + '/' + part;
    }

    return (
        <div className="p-4">
            <header className="mb-4 flex items-center justify-between">
                <h1 className="text-xl font-bold truncate">{pathname}</h1>
                <Link to="/db" className="text-blue-500 hover:underline">Settings</Link>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {pathname !== '/' && (
                     <Link to=".." className="block p-4 border rounded hover:bg-gray-100 flex flex-col items-center justify-center h-48">
                         <div className="text-4xl mb-2">⬆️</div>
                         <div className="text-sm text-center">Parent Directory</div>
                     </Link>
                )}

                {files.map((file, idx) => {
                    const fileUrl = join(pathname, file.name);
                    
                    let thumbUrl = null;
                    if (file.isImage) {
                        thumbUrl = join(pathname, `.thumbs/${file.name}`);
                    } else if (file.isVideo) {
                        const nameNoExt = file.name.substring(0, file.name.lastIndexOf('.'));
                        thumbUrl = join(pathname, `.thumbs/${nameNoExt}.jpg`);
                    }

                    return (
                        <Link key={idx} to={fileUrl} className="block border rounded overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                                {file.isDirectory ? (
                                    <span className="text-6xl">📁</span>
                                ) : (
                                    thumbUrl ? (
                                        <img src={thumbUrl} alt={file.name} className="object-cover w-full h-full" loading="lazy" />
                                    ) : (
                                        <span className="text-4xl">📄</span>
                                    )
                                )}
                                {file.isVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="bg-black/50 text-white rounded-full p-2">▶️</div>
                                    </div>
                                )}
                            </div>
                            <div className="p-2 text-sm truncate bg-white" title={file.name}>
                                {file.name}
                            </div>
                        </Link>
                    );
                })}
            </div>
            
            {files.length === 0 && (
                <div className="text-center text-gray-500 mt-8">Empty Directory</div>
            )}
        </div>
    );
}