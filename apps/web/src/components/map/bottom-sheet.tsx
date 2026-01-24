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
          isOpen ? "translate-y-0" : `translate-y-[calc(100%-${peekHeight}px)]`,
          isDragging && "transition-none",
          className
        )}
        style={{
          transform: isDragging
            ? `translateY(calc(${isOpen ? "0px" : `calc(100% - ${peekHeight}px)`} + ${dragOffset}px))`
            : undefined,
        }}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div className="bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
          {/* Drag Handle & Peek Header */}
          <div
            className="flex justify-center items-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none touch-none"
            onTouchStart={handleDragStart}
            onClick={handlePeekClick}
          >
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header - Show only when expanded */}
          {isOpen && title && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close panel"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>
          )}

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
