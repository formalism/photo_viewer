import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm']);

export async function getFileStats(filePath: string) {
    try {
        return await fsPromises.stat(filePath);
    } catch {
        return null;
    }
}

export async function listDirectory(dirPath: string) {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    
    // Filter out .thumbs directory and dotfiles if needed
    const items = entries.filter(e => e.name !== '.thumbs' && !e.name.startsWith('.'));
    
    return items.map(item => ({
        name: item.name,
        isDirectory: item.isDirectory(),
        isImage: !item.isDirectory() && IMAGE_EXTS.has(path.extname(item.name).toLowerCase()),
        isVideo: !item.isDirectory() && VIDEO_EXTS.has(path.extname(item.name).toLowerCase())
    }));
}

export async function ensureThumbnail(originalPath: string, thumbPath: string, isVideo: boolean) {
    // Check if thumbnail exists
    if (fs.existsSync(thumbPath)) return;

    // Ensure .thumbs directory exists
    const thumbDir = path.dirname(thumbPath);
    if (!fs.existsSync(thumbDir)) {
        await fsPromises.mkdir(thumbDir, { recursive: true });
    }

    try {
        if (isVideo) {
            await generateVideoThumbnail(originalPath, thumbPath);
        } else {
            await generateImageThumbnail(originalPath, thumbPath);
        }
    } catch (error) {
        console.error("Failed to generate thumbnail for", originalPath, error);
        // Create a placeholder error image or just fail?
        // For now, let's fail silently so the image appears broken
    }
}

async function generateImageThumbnail(input: string, output: string) {
    await sharp(input)
        .resize({ width: 320 }) // maintain aspect ratio
        .toFile(output);
}

async function generateVideoThumbnail(input: string, output: string) {
    return new Promise<void>((resolve, reject) => {
        // First get metadata to check duration
        ffmpeg.ffprobe(input, (err, metadata) => {
            if (err) return reject(err);
            
            const duration = metadata.format.duration || 0;
            const timestamp = duration > 2 ? '00:00:02.000' : '00:00:00.000'; // 2s or start

            ffmpeg(input)
                .screenshots({
                    timestamps: [timestamp],
                    filename: path.basename(output),
                    folder: path.dirname(output),
                    size: '320x?', // width 320, keep aspect ratio
                })
                .on('end', () => resolve())
                .on('error', (e) => reject(e));
        });
    });
}

export function isImage(filename: string) {
    return IMAGE_EXTS.has(path.extname(filename).toLowerCase());
}

export function isVideo(filename: string) {
    return VIDEO_EXTS.has(path.extname(filename).toLowerCase());
}
