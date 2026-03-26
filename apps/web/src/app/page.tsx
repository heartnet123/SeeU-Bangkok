"use client";

import { TextEffect, InView, AnimatedGroup, Magnetic } from "@/components/core";
import { Button } from "@/components/ui/button";
import { MapPin, MessageCircle, Heart, ArrowRight, User, Wand2, Route } from "lucide-react";
import { useTranslation } from "@/contexts/language-context"; 

export default function Home() {
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-white text-blue-950 font-sans selection:bg-blue-900 selection:text-white pb-0">
			{/* Utilitarian Grid Background for the entire page (very subtle) */}
			<div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.03]">
				<div className="w-full h-full bg-[linear-gradient(to_right,#1e3a8a_1px,transparent_1px),linear-gradient(to_bottom,#1e3a8a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
			</div>

			{/* Utilitarian Structural Lines */}
			<div className="fixed top-0 left-6 w-[1px] h-full bg-blue-900/10 z-50 pointer-events-none hidden md:block"></div>
			<div className="fixed top-0 right-6 w-[1px] h-full bg-blue-900/10 z-50 pointer-events-none hidden md:block"></div>

			{/* Hero Section */}
			<section className="relative min-h-[90vh] lg:min-h-screen flex items-center z-10 overflow-hidden border-b border-blue-900/10">
				{/* Full-width Background Image */}
				<div className="absolute inset-0 z-0 overflow-hidden group">
					{/* Gradient to ensure text readability on the left */}
					<div className="absolute inset-0 z-10"></div>
					{/* Lowered luminosity blend: reduced opacity and softer tint */}
					<div className="absolute inset-0 bg-blue-50/20 mix-blend-multiply z-10 pointer-events-none"></div>
					<div className="absolute inset-0 bg-[url('https://www.journee-mondiale.com/de/wp-content/uploads/2025/05/2025-05-26-12-35-08_.webp')] bg-cover bg-center bg-no-repeat mix-blend-luminosity opacity-40 group-hover:scale-105 transition-transform duration-[30s] ease-out"></div>
				</div>

				{/* Overlay Data UI */}				

				<div className="w-full relative z-20 container mx-auto max-w-[1400px] px-6 lg:px-12 pt-32 pb-24 lg:py-0 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8 min-h-[80vh]">
					{/* Text Content */}
					<div className="max-w-3xl flex flex-col justify-center shrink-0">
						<InView>
							
							<div className="flex flex-col gap-2 mb-8 mt-12 lg:mt-0">
								<TextEffect 
									as="h1" 
									preset="blur" 
									per="word" 
									className="text-5xl md:text-7xl lg:text-[6.5rem] leading-[0.95] tracking-tight font-medium text-blue-950"
								>
									{t("home.title1")}
								</TextEffect>
								<TextEffect 
									as="h1" 
									preset="blur" 
									per="word" 
									delay={0.2}
									className="text-5xl md:text-7xl lg:text-[6.5rem] leading-[0.95] tracking-tight font-medium text-blue-600 mb-4"
								>
									{t("home.title2")}
								</TextEffect>
							</div>

							<div className="w-24 h-[1px] bg-blue-900/20 mb-10"></div>
							
							<AnimatedGroup preset="slide" className="flex flex-col sm:flex-row gap-4 mt-4">
								<Magnetic intensity={0.1} range={30}>
									<Button className="h-14 px-8 bg-blue-950 hover:bg-blue-900 text-white rounded-none text-sm font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-3 w-full sm:w-auto shadow-none">
										<MapPin className="w-4 h-4" />
										{t("home.exploreMap")}
									</Button>
								</Magnetic>
								<Magnetic intensity={0.1} range={30}>
									<Button variant="outline" className="h-14 px-8 border-2 border-blue-900/20 bg-white/50 backdrop-blur-md hover:bg-white/80 text-blue-950 rounded-none text-sm font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-3 w-full sm:w-auto">
										<MessageCircle className="w-4 h-4" />
										{t("home.tripPlanner")}
									</Button>
								</Magnetic>
							</AnimatedGroup>
						</InView>
					</div>

					{/* Right UI Overlay (Chat) */}
					<div className="w-full max-w-[480px] lg:ml-auto hidden md:block perspective-[2000px]">
						<style dangerouslySetInnerHTML={{__html: `
							@keyframes smooth-float {
								0%, 100% { transform: translateY(0px); }
								50% { transform: translateY(-16px); }
							}
							.animate-smooth-float {
								animation: smooth-float 8s ease-in-out infinite;
							}
						`}} />
						<InView>
							<div className="animate-smooth-float">
								{/* Chat Overlay Component - Real UI Style */}
								<div className="relative z-10 w-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl p-6 hover:shadow-blue-900/10 transition-shadow duration-700">
									
									{/* Technical top border accent for Editorial Utilitarian look */}
									<div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-600 to-blue-400"></div>

								{/* User Message */}
								<div className="flex gap-4 items-start mb-6">
									<div className="w-10 h-10 rounded-none bg-slate-100/80 text-blue-900 border border-slate-200 flex items-center justify-center shrink-0">
										<User className="w-5 h-5" strokeWidth={1.5} />
									</div>
									<div className="pt-1">
										<p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">You</p>
										<p className="text-sm text-slate-700 leading-relaxed font-medium">แนะนำร้านอาหารท้องถิ่นลับๆ แถวท่าเตียนให้หน่อยครับ มีเวลา 1 ชั่วโมง?</p>
									</div>
								</div>
								
								<div className="w-full h-[1px] bg-slate-100 mb-6"></div>

								{/* AI Reply */}
								<div className="flex gap-4 items-start">
									<div className="w-10 h-10 border border-blue-600 bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
										<Wand2 className="w-5 h-5" strokeWidth={1.5} />
									</div>
									<div className="pt-1">
										<p className="text-[10px] font-mono uppercase tracking-widest text-blue-600 mb-1 flex items-center gap-2">
											<span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
											TripPlanner AI
										</p>
										<p className="text-sm text-slate-700 leading-relaxed font-medium">
											แนะนำ "ร้านลุงหวัง" ครับ เป็นร้านเก่าแก่ที่คนพื้นที่ชื่นชอบ เดินจากจุดที่คุณอยู่เพียง 5 นาที ระบบได้จัดคิวและคำนวณเวลาเดินลงในแผนที่แล้วครับ
										</p>
										
										{/* Interactive Map Button */}
										<div className="mt-4 inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors group">
											<Route className="text-blue-600 w-4 h-4" strokeWidth={1.5} />
											<span className="text-xs font-semibold text-slate-600 uppercase tracking-wide group-hover:text-blue-700">ดูเส้นทาง 350 เมตร</span>
										</div>
									</div>
								</div>
							</div>
							</div>
						</InView>
					</div>
				</div>
			</section>

			{/* UI Storytelling Section */}
			<section className="py-24 lg:py-32 bg-blue-950 text-white relative border-t border-blue-900 z-10 overflow-hidden">
				{/* Section grid background */}
				<div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"></div>

				<div className="container mx-auto px-6 max-w-[1400px] relative z-20">
					<InView>
						<div className="flex flex-col md:flex-row md:items-end justify-between mb-24 gap-8 border-b border-blue-900/50 pb-8">
							<div className="max-w-3xl">
								<TextEffect as="h2" preset="blur" className="text-3xl md:text-5xl font-medium tracking-tight mb-4">
									{t("features.title")}
								</TextEffect>
								<TextEffect as="p" preset="slide" delay={0.2} className="text-lg md:text-xl text-blue-200/60 font-medium tracking-tight">
									{t("features.subtitle")}
								</TextEffect>
							</div>
							<div className="text-blue-400 font-mono text-[10px] tracking-[0.2em] uppercase shrink-0">
								SYS.MODULE[02]
							</div>
						</div>
					</InView>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-blue-900/50 border border-blue-900/50">
						
						{/* MAP UI FEATURE */}
						<div className="group bg-blue-950 p-8 md:p-12 lg:p-16 flex flex-col relative overflow-hidden">
							<div className="mb-12 flex items-center justify-between">
								<MapPin className="w-6 h-6 text-blue-400" />
								<span className="font-mono text-[10px] tracking-widest text-blue-500/50 uppercase">Visual Layer</span>
							</div>
							
							<h3 className="text-2xl lg:text-3xl font-medium tracking-tight mb-4">{t("features.cards.interactiveMap.title")}</h3>
							<p className="text-blue-200/60 text-base leading-relaxed mb-16 max-w-md">{t("features.cards.interactiveMap.desc")}</p>
							
							{/* UI Mockup - The Map */}
							<div className="mt-auto relative w-full aspect-[4/3] bg-blue-900/20 border border-blue-800/30 overflow-hidden group-hover:bg-blue-900/30 transition-colors duration-700">
								{/* Map Grid */}
								<div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#60a5fa_1px,transparent_1px),linear-gradient(to_bottom,#60a5fa_1px,transparent_1px)] bg-[size:2rem_2rem]"></div>
								<div className="absolute inset-0 border-[0.5px] border-blue-500/20 rounded-full w-[200%] h-[200%] -top-1/2 -left-1/2 opacity-20 group-hover:scale-95 transition-transform duration-1000"></div>
								<div className="absolute inset-0 border-[0.5px] border-blue-400/20 rounded-full w-[150%] h-[150%] -top-1/4 -left-1/4 opacity-30 group-hover:scale-90 transition-transform duration-[1.5s]"></div>

								{/* Map Data Points */}
								<div className="absolute top-[30%] left-[40%] w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_15px_rgba(96,165,250,0.8)]">
									<div className="absolute -inset-2 border border-blue-400/50 rounded-full animate-ping opacity-20"></div>
								</div>
								
								<div className="absolute bottom-[40%] right-[30%] w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] transform group-hover:-translate-y-2 transition-transform duration-500 delay-100">
									<div className="w-1 h-1 bg-blue-900 rounded-full"></div>
								</div>

								{/* Connecting line */}
								<div className="absolute top-[32%] left-[41%] w-[28%] h-[26%] border-b border-r border-blue-400/30 border-dashed transform origin-top-left -skew-x-12 opacity-50"></div>

								{/* Integrating "Hidden Gems" as a UI popover on the map */}
								<div className="absolute bottom-6 left-6 right-6 bg-blue-950/90 backdrop-blur-sm border border-blue-800/80 p-5 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-200">
									<div className="flex items-center gap-3 mb-3 shrink-0">
										<Heart className="w-4 h-4 text-emerald-400" />
										<span className="text-xs font-semibold tracking-wider text-white uppercase">{t("features.cards.hiddenGems.title")}</span>
									</div>
									<p className="text-[11px] text-blue-200/70 leading-relaxed font-mono">
										{t("features.cards.hiddenGems.desc")}
									</p>
								</div>
							</div>
						</div>

						{/* CHAT UI FEATURE */}
						<div className="group bg-blue-950 p-8 md:p-12 lg:p-16 flex flex-col relative overflow-hidden">
							<div className="mb-12 flex items-center justify-between">
								<MessageCircle className="w-6 h-6 text-emerald-400" />
								<span className="font-mono text-[10px] tracking-widest text-emerald-500/50 uppercase">Logic Layer</span>
							</div>
							
							<h3 className="text-2xl lg:text-3xl font-medium tracking-tight mb-4">{t("features.cards.tripPlanner.title")}</h3>
							<p className="text-blue-200/60 text-base leading-relaxed mb-16 max-w-md">{t("features.cards.tripPlanner.desc")}</p>
							
							{/* UI Mockup - The Chat */}
							<div className="mt-auto relative w-full aspect-[4/3] bg-transparent flex flex-col justify-end gap-6 p-4 md:p-8 border border-blue-800/30 group-hover:border-blue-700/50 transition-colors duration-700">
								
								{/* Chat Line 1 */}
								<div className="self-end bg-blue-900/40 border border-blue-800/50 p-4 min-w-[60%] max-w-[85%] transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 delay-100">
									<div className="h-1.5 w-full bg-blue-200/30 mb-2"></div>
									<div className="h-1.5 w-2/3 bg-blue-200/30"></div>
								</div>

								{/* Chat Line 2 (AI Response) */}
								<div className="self-start bg-blue-950 border border-emerald-900/50 shadow-[-4px_0_0_0_rgba(16,185,129,0.4)] p-5 min-w-[70%] max-w-[90%] transform -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 delay-300">
									<div className="flex items-center gap-2 mb-4 text-[10px] font-mono text-emerald-400 tracking-wider uppercase">
										<span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse"></span>
										Synthesizing Plan
									</div>
									<div className="flex flex-col gap-2">
										<div className="h-1 w-full bg-blue-100/20"></div>
										<div className="h-1 w-full bg-blue-100/20"></div>
										<div className="h-1 w-4/5 bg-blue-100/20"></div>
									</div>
									
									<div className="mt-6 border-t border-blue-800/50 pt-4 flex justify-between items-center group/btn cursor-pointer">
										<span className="text-[10px] text-blue-300 font-mono uppercase tracking-widest">Execute()</span>
										<ArrowRight className="w-3 h-3 text-emerald-400 group-hover/btn:translate-x-2 transition-transform" />
									</div>
								</div>
							</div>
						</div>

					</div>
				</div>
			</section>
		</div>
	);
}
