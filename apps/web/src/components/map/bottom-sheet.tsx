"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
  peekHeight?: number;
  isDraggable?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  className,
  peekHeight = 120,
  isDraggable = true,
  onOpenChange,
}: BottomSheetProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const collapsedOffset = `calc(100% - ${peekHeight}px)`;

  const handleDragStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (!isDragging || !isOpen) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY;

    // Allow dragging down to close, or up to expand
    if (diff > 0) {
      // Dragging down - can close
      setDragOffset(diff);
    } else if (contentRef.current && contentRef.current.scrollTop === 0) {
      // Only allow dragging up if content is at top
      setDragOffset(diff);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);

    // If dragged down more than 100px or down more than 30%, close the sheet
    if (dragOffset > 100 || dragOffset > (window.innerHeight * 0.3)) {
      onClose();
      onOpenChange?.(false);
    }

    setDragOffset(0);
  };

  const handlePeekClick = () => {
    if (!isOpen) {
      onOpenChange?.(true);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setDragOffset(0);
    }
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform duration-300 ease-out",
          isDragging && "transition-none",
          className
        )}
        style={{
          transform: isDragging
            ? `translateY(calc(${isOpen ? "0px" : collapsedOffset} + ${dragOffset}px))`
            : `translateY(${isOpen ? "0px" : collapsedOffset})`,
        }}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div className="bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
          {/* Drag Handle & Peek Header */}
          <div
            className="flex flex-col items-center justify-center gap-2 px-4 pt-3 pb-3 cursor-grab active:cursor-grabbing select-none touch-none border-b border-slate-200/80"
            onTouchStart={handleDragStart}
            onClick={handlePeekClick}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse trip panel" : "Expand trip panel"}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenChange?.(!isOpen);
                if (isOpen) {
                  onClose();
                }
              }
            }}
          >
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
            <div className="flex items-center justify-between w-full text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {title || "Trip details"}
                </p>
                <p className="text-slate-500 text-xs">
                  {isOpen ? "Swipe down or tap to collapse" : "Tap to reopen your trip and itinerary"}
                </p>
              </div>
              <ChevronUp
                className={cn(
                  "h-5 w-5 text-slate-500 transition-transform duration-200",
                  !isOpen && "rotate-180"
                )}
              />
            </div>
          </div>

          {/* Content - Show only when expanded */}
          {isOpen && (
            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto pb-4"
              onTouchStart={(e) => {
                // Allow drag on empty space in content
                if (e.target === contentRef.current) {
                  handleDragStart(e);
                }
              }}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
