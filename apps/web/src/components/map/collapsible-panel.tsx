"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface CollapsiblePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  position: "left" | "right";
  title?: string;
  className?: string;
  width?: string;
}

export function CollapsiblePanel({
  isOpen,
  onClose,
  children,
  position,
  title,
  className,
  width = "w-[380px]",
}: CollapsiblePanelProps) {
  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 z-20 transition-transform duration-300 ease-in-out",
        position === "left" ? "left-0" : "right-0",
        isOpen
          ? "translate-x-0"
          : position === "left"
            ? "-translate-x-full"
            : "translate-x-full",
        width,
        className
      )}
    >
      <div
        className={cn(
          "h-full bg-white/95 backdrop-blur-md shadow-2xl flex flex-col",
          position === "left"
            ? "border-r border-slate-200"
            : "border-l border-slate-200"
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white/80">
          {title && (
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close panel"
          >
            {position === "left" ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
