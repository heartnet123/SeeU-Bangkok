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
  width = "w-[400px]",
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

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
