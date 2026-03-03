import { Badge } from "@/components/ui/badge";

interface ChatToolCallDisplayProps {
	tools: string[];
	maxVisible?: number;
}

export function ChatToolCallDisplay({
	tools,
	maxVisible = 3,
}: ChatToolCallDisplayProps) {
	if (tools.length === 0) return null;

	return (
		<div className="flex gap-1 flex-wrap">
			{tools.slice(0, maxVisible).map((tool, i) => (
				<Badge key={`${tool}-${i}`} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
					{tool}
				</Badge>
			))}
			{tools.length > maxVisible && (
				<span className="text-[10px]">+{tools.length - maxVisible}</span>
			)}
		</div>
	);
}
