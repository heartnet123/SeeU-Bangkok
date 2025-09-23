"use client";

import { TextEffect, InView, AnimatedGroup, Magnetic } from "@/components/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, MessageCircle, Heart } from "lucide-react";


export default function Home() {
	return (
		<div className="min-h-screen bg-white">
			{/* Hero Section */}
			<div className="relative min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 flex items-center justify-center overflow-hidden">
				{/* Background Pattern/Texture */}
				<div className="absolute inset-0 bg-black/20"></div>
				
				{/* Background Image Placeholder (if you want to add the actual image later) */}
				<div className="absolute inset-0 bg-[url('/test.gif')] bg-cover bg-center bg-no-repeat"></div>
				
				<div className="relative z-10 container mx-auto max-w-6xl px-6 text-center">
					<InView>
						<div className="mb-8">
							<TextEffect
								as="h1"
								preset="fade-in-blur"
								per="word"
								className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-4 leading-tight"
							>
								Discover Bangkok's
							</TextEffect>
							<TextEffect
								as="h1"
								preset="fade-in-blur"
								per="word"
								delay={0.3}
								className="text-5xl md:text-7xl lg:text-8xl font-bold text-orange-500 mb-8 leading-tight"
							>
								Hidden Gems
							</TextEffect>
						</div>
					</InView>
					
					<AnimatedGroup
						preset="slide"
						className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
					>
						<Magnetic intensity={0.3} range={80}>
							<Button className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 text-xl font-semibold rounded-lg transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl">
								<MapPin className="w-6 h-6" />
								Explore Map
							</Button>
						</Magnetic>
						
						<Magnetic intensity={0.3} range={80}>
							<Button 
								variant="outline" 
								className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-gray-900 px-12 py-6 text-xl font-semibold rounded-lg transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl"
							>
								<MessageCircle className="w-6 h-6" />
								Trip Planner
							</Button>
						</Magnetic>
					</AnimatedGroup>
				</div>
				
				{/* Scroll Indicator */}
				<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
					<div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
						<div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse"></div>
					</div>
				</div>
			</div>

			{/* Features Section */}
			<div className="py-20 bg-gray-50">
				<div className="container mx-auto max-w-6xl px-6">
					<InView>
						<div className="text-center mb-16">
							<TextEffect
								as="h2"
								preset="fade-in-blur"
								per="word"
								className="text-4xl md:text-5xl font-bold text-gray-900 mb-6"
							>
								Explore Bangkok Like Never Before
							</TextEffect>
							<TextEffect
								as="p"
								preset="slide"
								per="word"
								delay={0.3}
								className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed"
							>
								Discover authentic experiences, local favorites, and off-the-beaten-path destinations with our AI-powered travel companion.
							</TextEffect>
						</div>
					</InView>

					{/* Feature Cards */}
					<AnimatedGroup
						preset="blur-slide"
						className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
					>
						<Card className="p-8 text-center hover:shadow-lg transition-all duration-300 border-0 bg-white group">
							<div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
								<MapPin className="w-8 h-8 text-blue-600" />
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Interactive Map</h3>
							<p className="text-gray-600 leading-relaxed">Navigate Bangkok with our interactive map featuring real-time information and personalized recommendations.</p>
						</Card>

						<Card className="p-8 text-center hover:shadow-lg transition-all duration-300 border-0 bg-white group">
							<div className="w-16 h-16 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
								<MessageCircle className="w-8 h-8 text-orange-600" />
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Trip Planner</h3>
							<p className="text-gray-600 leading-relaxed">Get instant answers and personalized travel advice from our intelligent Trip Planner trained on local knowledge.</p>
						</Card>

						<Card className="p-8 text-center hover:shadow-lg transition-all duration-300 border-0 bg-white group">
							<div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
								<Heart className="w-8 h-8 text-green-600" />
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Hidden Gems</h3>
							<p className="text-gray-600 leading-relaxed">Discover secret spots, local favorites, and authentic experiences that only locals know about.</p>
						</Card>
					</AnimatedGroup>
				</div>
			</div>
		</div>
	);
}
