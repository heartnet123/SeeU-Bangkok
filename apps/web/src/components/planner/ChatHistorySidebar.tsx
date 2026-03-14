"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatSession {
	id: string;
	updatedAt: Date;
	metadata: { title?: string };
}

interface ChatHistorySidebarProps {
	sessions: ChatSession[];
	activeSessionId: string | null;
	onSelectSession: (id: string) => void;
	onNewSession: () => void;
	onDeleteSession: (id: string) => void;
	isLoading: boolean;
}

function formatDate(date: Date): string {
	const now = new Date();
	const d = new Date(date);
	const diffMs = now.getTime() - d.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;
	return d.toLocaleDateString();
}

export function ChatHistorySidebar({
	sessions,
	activeSessionId,
	onSelectSession,
	onNewSession,
	onDeleteSession,
	isLoading,
}: ChatHistorySidebarProps) {
	return (
		<div className="flex flex-col h-full gap-3">
			<Button
				onClick={onNewSession}
				className="w-full gap-2"
				variant="outline"
			>
				<Plus className="h-4 w-4" />
				New Chat
			</Button>

			{isLoading ? (
				<div className="space-y-2">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-14 rounded-lg bg-slate-100 animate-pulse"
						/>
					))}
				</div>
			) : sessions.length === 0 ? (
				<div className="flex flex-col items-center justify-center flex-1 text-center text-slate-400 gap-2 py-8">
					<MessageSquare className="h-8 w-8 opacity-40" />
					<p className="text-sm">No chat history yet</p>
					<p className="text-xs">Start a conversation to save it here</p>
				</div>
			) : (
				<div className="flex flex-col gap-1 overflow-y-auto flex-1">
					{sessions.map((session) => {
						const title = session.metadata?.title || `Chat on ${formatDate(session.updatedAt)}`;
						const isActive = session.id === activeSessionId;

						return (
							<div
								key={session.id}
								className={cn(
									"group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors",
									isActive
										? "bg-primary/10 text-primary"
										: "hover:bg-slate-100 text-slate-700"
								)}
								onClick={() => onSelectSession(session.id)}
							>
								<MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">{title}</p>
									<p className="text-xs text-slate-400">{formatDate(session.updatedAt)}</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-slate-400 hover:text-red-500"
									onClick={(e) => {
										e.stopPropagation();
										if (confirm("Delete this chat history?")) {
											onDeleteSession(session.id);
										}
									}}
								>
									<Trash2 className="h-3 w-3" />
								</Button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
