"use client";
import Link from "next/link";
import { Button } from "./ui/button";
import { Search, Menu, X } from "lucide-react";
import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { AuthButton } from "./auth/auth-button";
import { AnimatedGroup } from "./core/animated-group";
import { motion } from "motion/react";
import LanguageToggle from "./language-toggle";
import { useTranslation } from "@/contexts/language-context";
import { useAuth } from "@/contexts/auth-context";

export default function Header() {
	const { user, loading } = useAuth();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const pathname = usePathname();

	const { t } = useTranslation();

	// Debug: Check user role for admin link
	console.log("Current User:", user);

	const links = useMemo(() => {
		const baseLinks = [
			{ to: "/", label: t("nav.home") },
			{ to: "/places", label: t("nav.places") },
			{ to: "/map", label: t("nav.map") },
			{ to: "/saved-trips", label: t("nav.savedTrips") },
		];

		if (user?.role === "admin") {
			baseLinks.push({ to: "/admin/places", label: t("nav.admin") });
		}

		return baseLinks;
	}, [user, t]);

	// Prevent flash of unauthenticated content by returning a placeholder while loading
	if (loading) {
		return <div className="w-full h-[84px] bg-white/90 backdrop-blur-md shadow-lg" />;
	}

	return (
		<motion.header 
			className="w-full bg-white/90 backdrop-blur-md shadow-lg"
			initial={{ y: -100, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ duration: 0.8, ease: "easeOut" }}
		>
			<div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
				{/* Logo */}
				<div className="flex items-center gap-2">
					<Link href="/" className="text-blue-400 text-xl font-bold hover:text-blue-300 transition-colors duration-300 cursor-pointer">
					<span>SeeU Bangkok</span>
				</Link>
			</div>
			{/* Center Rounded Navigation Container */}
				<motion.div 
					className="hidden md:flex items-center bg-gray-300/60 backdrop-blur-lg rounded-full px-4 py-3 border border-gray-300/50 shadow-lg"
					initial={{ scale: 0.9, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ duration: 0.5, delay: 0.2 }}
				>
					<AnimatedGroup 
						preset="slide" 
						className="flex items-center gap-2"
					>
						{links.map(({ to, label }) => {
							const isActive = pathname === to;
							return (
								<Link
									key={to}
									href={to}
									className={`
										relative px-5 py-2.5 mx-1 text-sm font-medium rounded-full transition-all duration-300
										${isActive 
											? 'text-white bg-blue-500 shadow-lg shadow-blue-500/25' 
											: 'text-gray-900 hover:text-white hover:bg-gray-700/50'
										}
										group overflow-hidden
									`}
								>
									<span className="relative z-10">{label}</span>
									{!isActive && (
										<motion.div
											className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full"
											initial={{ scale: 0, opacity: 0 }}
											whileHover={{ scale: 1, opacity: 1 }}
											transition={{ duration: 0.2 }}
											style={{ zIndex: 1 }}
										/>
									)}
									{isActive && (
										<motion.div
											className="absolute inset-0 bg-blue-500 rounded-full"
											layoutId="activeTab"
											transition={{ type: "spring", stiffness: 500, damping: 30 }}
											style={{ zIndex: 1 }}
										/>
									)}
								</Link>
							);
						})}
					</AnimatedGroup>
				</motion.div>

				{/* Right side - Search and Auth Button */}
				<div className="flex items-center gap-4">
 
					<div className="hidden sm:flex">					<LanguageToggle className="mr-2" />
				</div>

				<div className="hidden sm:flex">						<AuthButton />
					</div>
					{/* Mobile menu button */}
					<motion.button 
						className="md:hidden p-3 hover:bg-slate-100 rounded-full transition-all duration-300 border border-slate-300/70 backdrop-blur-sm hover:border-blue-300"
						onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
						whileHover={{ scale: 1.05, y: -2 }}
						whileTap={{ scale: 0.95 }}
					>
						<motion.div
							animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
							transition={{ duration: 0.3 }}
						>
							{isMobileMenuOpen ? (
								<X className="w-5 h-5 text-slate-900" />
							) : (
								<Menu className="w-5 h-5 text-slate-900" />
							)}
						</motion.div>
					</motion.button>
				</div>
			</div>

			{/* Mobile Navigation Menu */}
			{isMobileMenuOpen && (
				<motion.div 
					className="md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg"
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -20 }}
					transition={{ duration: 0.3 }}
				>
					<AnimatedGroup 
						preset="slide"
						className="flex flex-col px-6 py-4 space-y-3"
					>
						{links.map(({ to, label }) => {
							const isActive = pathname === to;
							return (
								<Link
									key={to}
									href={to}
									className={`
										block px-4 py-3 font-medium rounded-lg transition-all duration-300
										${isActive 
											? 'text-white bg-blue-500 shadow-lg' 
											: 'text-slate-900 hover:text-blue-600 hover:bg-slate-100'
										}
									`}
									onClick={() => setIsMobileMenuOpen(false)}
								>
									{label}
									{isActive && (
										<span className="ml-2 text-xs bg-blue-400 text-blue-900 px-2 py-1 rounded-full">
											{t("nav.current")}
										</span>
									)}
								</Link>
							);
						})}
						<div className="pt-4 border-t border-slate-200 space-y-3">
							<AuthButton />
							<LanguageToggle />
						</div>
					</AnimatedGroup>
				</motion.div>
			)}
		</motion.header>
	);
}
