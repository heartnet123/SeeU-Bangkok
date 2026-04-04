"use client";

import { motion } from "motion/react";

// Category definitions — keep in sync with map-container.tsx
const FILTER_CATEGORIES = [
    { key: "all", label: "All", icon: "🗺️", color: "#6B7280" },
    { key: "temple", label: "Temple", icon: "🏛️", color: "#F59E0B" },
    { key: "restaurant", label: "Restaurant", icon: "🍽️", color: "#10B981" },
    { key: "market", label: "Market", icon: "🛍️", color: "#EF4444" },
    { key: "park", label: "Park", icon: "🌳", color: "#059669" },
    { key: "museum", label: "Museum", icon: "🏛️", color: "#8B5CF6" },
    { key: "shopping", label: "Shopping", icon: "🛒", color: "#EC4899" },
] as const;

export type FilterCategory = (typeof FILTER_CATEGORIES)[number]["key"];

interface SmartFilterBarProps {
    activeFilter: FilterCategory;
    onFilterChange: (filter: FilterCategory) => void;
    isDarkMode?: boolean;
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
    activeFilter,
    onFilterChange,
    isDarkMode = false,
}) => {
    return (
        <motion.div
            className="absolute top-4 left-4 z-20 max-w-[calc(100%-120px)]"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
        >
            <div
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full shadow-lg backdrop-blur-md overflow-x-auto scrollbar-hide ${isDarkMode
                        ? "bg-gray-900/80 border border-gray-700/50"
                        : "bg-white/90 border border-gray-200"
                    }`}
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {FILTER_CATEGORIES.map((cat) => {
                    const isActive = activeFilter === cat.key;

                    return (
                        <button
                            key={cat.key}
                            onClick={() => onFilterChange(cat.key)}
                            className={`
                relative flex items-center gap-1.5 px-3 py-1.5 rounded-full
                text-xs font-medium whitespace-nowrap
                transition-colors duration-200 cursor-pointer
                ${isActive
                                    ? "text-white"
                                    : isDarkMode
                                        ? "text-gray-300 hover:text-white hover:bg-gray-700/50"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                }
              `}
                            title={`Show ${cat.label}`}
                        >
                            {/* Animated background for active state */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeFilter"
                                    className="absolute inset-0 rounded-full"
                                    style={{ backgroundColor: cat.color }}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                />
                            )}
                            <span className="relative z-10 text-sm">{cat.icon}</span>
                            <span className="relative z-10 hidden sm:inline">
                                {cat.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </motion.div>
    );
};
