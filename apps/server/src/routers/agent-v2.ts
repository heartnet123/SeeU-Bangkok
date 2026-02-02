// Agent Router V2 - Multi-agent supervisor with SSE streaming
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { optionalAuthMiddleware } from "../middleware/auth";
import { streamSSE } from "hono/streaming";
import { streamAgentExecution, runAgent } from "../agent";

const agentV2 = new Hono();

// Schema definitions
const messageSchema = z.object({
	role: z.enum(["system", "user", "assistant", "tool"]),
	content: z.string().min(1),
	name: z.string().optional(),
});

const agentRequestSchema = z.object({
	messages: z.array(messageSchema).min(1),
	userLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
	sessionId: z.string().optional(),
	stream: z.boolean().optional().default(true),
});

// POST /api/agent/v2 - Multi-agent supervisor endpoint with streaming
agentV2.post(
	"/",
	optionalAuthMiddleware,
	zValidator("json", agentRequestSchema),
	async (c) => {
		const body = c.req.valid("json");
		const user = c.get("user");

		const options = {
			messages: body.messages,
			userLocation: body.userLocation,
			sessionId: body.sessionId,
			userId: user?.id,
		};

		// Streaming mode
		if (body.stream) {
			return streamSSE(c, async (stream) => {
				try {
					for await (const event of streamAgentExecution(options)) {
						await stream.writeSSE({
							event: event.event,
							data: event.data,
						});
					}
				} catch (err: any) {
					await stream.writeSSE({
						event: "error",
						data: err.message || "Processing failed",
					});
				} finally {
					stream.close();
				}
			});
		}

		// Non-streaming mode
		const result = await runAgent(options);

		if (!result.success) {
			return c.json({ error: result.error }, 500);
		}

		return c.json({
			success: true,
			response: result.response,
			tools_used: result.tools_used,
			itinerary: result.itinerary,
			places: result.places,
			user: user?.id || null,
		});
	}
);

// GET /api/agent/v2/health - Health check
agentV2.get("/health", (c) => {
	return c.json({
		status: "ok",
		service: "agent-v2",
		architecture: "multi-agent-supervisor",
		agents: ["researcher", "planner", "critic"],
	});
});

// GET /api/agent/v2/agents - List available agents
agentV2.get("/agents", (c) => {
	return c.json({
		agents: [
			{
				name: "researcher_agent",
				description: "Finds places, searches locations, performs semantic search",
				tools: ["search_places", "nearby_places", "vector_search"],
			},
			{
				name: "planner_agent",
				description: "Creates optimized routes and itineraries",
				tools: ["build_route", "plan_itinerary"],
			},
			{
				name: "critic_agent",
				description: "Validates itineraries, suggests improvements",
				tools: ["validate_itinerary"],
			},
		],
	});
});

export default agentV2;
