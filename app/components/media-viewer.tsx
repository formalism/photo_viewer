import { useState, useEffect, useCallback, useRef } from "react";

const SWIPE_THRESHOLD = 50; // minimum px to count as a swipe

export interface MediaViewerProps {
    files: Array<{
        name: string;
        kind: "image" | "video";
        fileUrl: string;
    }>;
    currentIndex: number;
    onClose: () => void;
    onNavigate: (index: number) => void;
}

export function MediaViewer({
    files,
    currentIndex,
    onClose,
    onNavigate,
}: MediaViewerProps) {
    const file = files[currentIndex];
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === files.length - 1;

    // --- touch / mouse swipe tracking ---
    const startX = useRef<number | null>(null);
    const dragging = useRef(false);

    const handlePrev = useCallback(() => {
        if (!isFirst) onNavigate(currentIndex - 1);
    }, [isFirst, currentIndex, onNavigate]);

    const handleNext = useCallback(() => {
        if (!isLast) onNavigate(currentIndex + 1);
    }, [isLast, currentIndex, onNavigate]);

    // keyboard
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowLeft") {
                handlePrev();
            } else if (e.key === "ArrowRight") {
                handleNext();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose, handlePrev, handleNext]);

    // lock body scroll while viewer is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    // --- swipe handlers (touch) ---
    const onTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) >= SWIPE_THRESHOLD) {
            if (dx > 0) handlePrev();
            else handleNext();
        }
        startX.current = null;
    };

    // --- swipe handlers (mouse drag) ---
    const onMouseDown = (e: React.MouseEvent) => {
        // only primary button
        if (e.button !== 0) return;
        startX.current = e.clientX;
        dragging.current = true;
    };
    const onMouseUp = (e: React.MouseEvent) => {
        if (!dragging.current || startX.current === null) return;
        dragging.current = false;
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) >= SWIPE_THRESHOLD) {
            if (dx > 0) handlePrev();
            else handleNext();
        }
        startX.current = null;
    };

    // backdrop click (close only if clicking backdrop, not content)
    const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={onBackdropClick}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
        >
            {/* close button */}
            <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                aria-label="閉じる"
            >
                ✕
            </button>

            {/* filename */}
            <div className="absolute left-4 top-4 z-10 max-w-[60%] truncate rounded-full bg-slate-800/80 px-4 py-2 text-sm text-slate-200">
                {file.name}
            </div>

            {/* counter */}
            <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-800/80 px-4 py-2 text-sm text-slate-300">
                {currentIndex + 1} / {files.length}
            </div>

            {/* prev button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                }}
                disabled={isFirst}
                className="absolute left-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800/70 text-2xl text-slate-200 transition hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-30"
                aria-label="前のファイル"
            >
                ‹
            </button>

            {/* next button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                }}
                disabled={isLast}
                className="absolute right-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800/70 text-2xl text-slate-200 transition hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-30"
                aria-label="次のファイル"
            >
                ›
            </button>

            {/* media content */}
            <div
                className="flex max-h-[85vh] max-w-[90vw] items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                {file.kind === "video" ? (
                    <video
                        key={file.fileUrl}
                        src={file.fileUrl}
                        controls
                        autoPlay
                        className="max-h-[85vh] max-w-[90vw] rounded-lg"
                    />
                ) : (
                    <img
                        key={file.fileUrl}
                        src={file.fileUrl}
                        alt={file.name}
                        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
                        draggable={false}
                    />
                )}
            </div>
        </div>
    );
}
