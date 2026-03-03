import { useMemo } from "react";
import { Loader2, Zap, CircleDot, Search, Database, Sparkles, Route, MapPin, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatToolCallDisplay } from "./ChatToolCallDisplay";
import type { WorkflowStepData } from "./types";
import {
	ChainOfThought,
	ChainOfThoughtHeader,
	ChainOfThoughtContent,
	ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";

import type { LucideIcon } from "lucide-react";

const STEP_ICON: Record<string, LucideIcon> = {
	planner: CircleDot,
	search: Search,
	retrieve: Database,
	reasoning: Sparkles,
	route: Route,
	location: MapPin,
};

interface WorkflowPanelProps {
	steps: WorkflowStepData[];
	isProcessing?: boolean;
}

export function AgentWorkflowVisualization({ steps, isProcessing }: WorkflowPanelProps) {
	if (!steps.length && !isProcessing) return null;

	return (
		<div className="px-1 py-1 space-y-4 relative">
			{steps.map((step, idx) => {
				const isStepLoading = step.status === "loading";
				const Icon = STEP_ICON[step.type] ?? CheckCircle2;
				const badges = step.badges ?? [];
				const hasBadges = badges.length > 0;

				return (
					<ChainOfThoughtStep
						key={idx}
						status={step.status === "complete" ? "complete" : step.status === "loading" ? "active" : "pending"}
						icon={isStepLoading ? Loader2 : Icon}
						className={cn(isStepLoading && "[&>div>svg]:animate-spin")}
						label={
							<div className="flex items-center gap-1.5 flex-wrap">
								<span className={cn(
									"text-xs font-medium",
									step.status === "pending" && "text-muted-foreground/50",
									step.status === "loading" && "text-foreground",
									step.status === "complete" && "text-muted-foreground",
								)}>
									{step.label}
								</span>
								{hasBadges && <ChatToolCallDisplay tools={badges} />}
							</div>
						}
					/>
				);
			})}
			{isProcessing && (
				<ChainOfThoughtStep
					status="active"
					icon={Loader2}
					className="[&>div>svg]:animate-spin"
					label={<span className="text-xs font-medium text-foreground">Processing...</span>}
				/>
			)}
		</div>
	);
}

interface WorkflowSummaryProps {
	steps: WorkflowStepData[];
	latency?: number;
}

export function WorkflowSummary({ steps, latency }: WorkflowSummaryProps) {
	const summary = useMemo(() => {
		const agents = steps
			.filter((s) => ["search", "route", "reasoning"].includes(s.type))
			.map((s) => {
				if (s.type === "search") return "Researcher";
				if (s.type === "route") return "Planner";
				if (s.type === "reasoning") return "Critic";
				return s.type;
			});
		const unique = [...new Set(agents)];
		return unique.length > 0 ? `Agents: ${unique.join(" → ")}` : `${steps.length} steps completed`;
	}, [steps]);

	return (
		<ChainOfThought className="w-full">
			<ChainOfThoughtHeader>
				<div className="flex items-center gap-2 flex-1 pt-0.5">
					<span className="font-medium text-xs text-foreground/80">{summary}</span>
					{latency !== undefined && <span className="text-muted-foreground text-[10px] uppercase font-mono tracking-wider ml-auto pr-2">{latency.toFixed(1)}s</span>}
				</div>
			</ChainOfThoughtHeader>
			<ChainOfThoughtContent className="mb-4">
				<div className="rounded-lg border border-border/50 bg-accent/20 px-4 py-3">
					<AgentWorkflowVisualization steps={steps} />
				</div>
			</ChainOfThoughtContent>
		</ChainOfThought>
	);
}

export function ActiveWorkflowStatus({ steps, isProcessing }: WorkflowPanelProps) {
	return (
		<ChainOfThought defaultOpen className="w-full">
			<ChainOfThoughtHeader>
				<div className="flex items-center gap-2 flex-1 pt-0.5">
					<span className="font-medium text-xs text-foreground/80">
						{isProcessing ? "Thinking..." : "Finalizing..."}
					</span>
				</div>
			</ChainOfThoughtHeader>
			<ChainOfThoughtContent className="mb-3">
				<div className="rounded-lg border border-border/50 bg-accent/20 px-4 py-3">
					<AgentWorkflowVisualization steps={steps} isProcessing={isProcessing} />
				</div>
			</ChainOfThoughtContent>
		</ChainOfThought>
	);
}
