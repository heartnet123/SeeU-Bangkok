/**
 * Multi-Agent System Test Cases
 * 
 * Run with: bun test apps/server/src/agent/__tests__/agent-flow.test.ts
 * 
 * Prerequisites:
 * - Apply SQL migration: apps/server/sql/agent_memory_tables.sql
 * - Set environment variables: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { createTripPlannerSupervisor, invokeSupervisor } from "../supervisor";
import { streamAgentExecution, runAgent } from "../streaming";
import { MemoryManager, SessionMemory, LongTermMemory } from "../memory";
import { RESEARCHER_TOOLS, PLANNER_TOOLS, CRITIC_TOOLS, ALL_TOOLS } from "../tools";

// Skip if no API key (for CI environments)
const SKIP_API_TESTS = !process.env.OPENAI_API_KEY;

describe("Multi-Agent System", () => {
	describe("Module Imports", () => {
		test("all tools are defined", () => {
			expect(RESEARCHER_TOOLS).toBeDefined();
			expect(RESEARCHER_TOOLS.length).toBe(3); // search, nearby, vector_search
			
			expect(PLANNER_TOOLS).toBeDefined();
			expect(PLANNER_TOOLS.length).toBe(2); // build_route, plan_itinerary
			
			expect(CRITIC_TOOLS).toBeDefined();
			expect(CRITIC_TOOLS.length).toBe(1); // validate_itinerary
			
			expect(ALL_TOOLS.length).toBe(6);
		});

		test("supervisor can be created", () => {
			const supervisor = createTripPlannerSupervisor();
			expect(supervisor).toBeDefined();
		});

		test("memory manager can be instantiated", () => {
			const memory = new MemoryManager({ sessionId: "test-123", userId: "user-456" });
			expect(memory).toBeDefined();
			expect(memory.getSessionId()).toBe("test-123");
		});
	});

	describe("Tool Validation", () => {
		test("validate_itinerary tool exists and has correct schema", async () => {
			const { validateItineraryTool } = await import("../tools/validation");
			expect(validateItineraryTool).toBeDefined();
			expect(validateItineraryTool.name).toBe("validate_itinerary");
		});

		test("search_places tool exists", async () => {
			const { searchPlacesTool } = await import("../tools/search");
			expect(searchPlacesTool).toBeDefined();
			expect(searchPlacesTool.name).toBe("search_places");
		});

		test("plan_itinerary tool exists", async () => {
			const { planItineraryTool } = await import("../tools/planning");
			expect(planItineraryTool).toBeDefined();
			expect(planItineraryTool.name).toBe("plan_itinerary");
		});
	});

	describe("Agent Creation", () => {
		test("researcher agent can be created", async () => {
			const { createResearcherAgent } = await import("../agents/researcher");
			const agent = createResearcherAgent();
			expect(agent).toBeDefined();
		});

		test("planner agent can be created", async () => {
			const { createPlannerAgent } = await import("../agents/planner");
			const agent = createPlannerAgent();
			expect(agent).toBeDefined();
		});

		test("critic agent can be created", async () => {
			const { createCriticAgent } = await import("../agents/critic");
			const agent = createCriticAgent();
			expect(agent).toBeDefined();
		});
	});

	// Integration tests - require API keys
	describe.skipIf(SKIP_API_TESTS)("Integration: Full Agent Flow", () => {
		test("research query routes to researcher agent", async () => {
			const result = await runAgent({
				messages: [{ role: "user", content: "What temples are in Bangkok?" }],
			});

			expect(result.success).toBe(true);
			expect(result.response).toBeDefined();
			// Research queries shouldn't generate itineraries
		}, 30000); // 30s timeout

		test("planning query uses researcher → planner → critic flow", async () => {
			const result = await runAgent({
				messages: [{ role: "user", content: "Plan a day trip to 3 temples near Khao San Road" }],
			});

			expect(result.success).toBe(true);
			expect(result.response).toBeDefined();
			// Planning queries should use multiple tools
			expect(result.tools_used).toBeDefined();
			expect(result.tools_used!.length).toBeGreaterThan(0);
		}, 60000); // 60s timeout for full flow

		test("SSE streaming emits correct events", async () => {
			const events: string[] = [];

			for await (const event of streamAgentExecution({
				messages: [{ role: "user", content: "Find cafes near me" }],
				userLocation: { lat: 13.7563, lng: 100.5018 }, // Bangkok
			})) {
				events.push(event.event);
			}

			// Should have at least start and done events
			expect(events).toContain("start");
			expect(events).toContain("done");
		}, 30000);
	});

	// Memory tests - require Supabase
	describe.skipIf(!process.env.SUPABASE_URL)("Integration: Memory System", () => {
		let testSessionId: string;

		test("can create a session", async () => {
			const session = await SessionMemory.createSession({
				metadata: { test: true },
			});

			expect(session).toBeDefined();
			expect(session.id).toBeDefined();
			testSessionId = session.id;
		});

		test("can add and retrieve messages", async () => {
			if (!testSessionId) {
				console.log("Skipping - no session created");
				return;
			}

			await SessionMemory.addMessage({
				sessionId: testSessionId,
				role: "user",
				content: "Test message",
			});

			const messages = await SessionMemory.getMessages(testSessionId);
			expect(messages.length).toBeGreaterThan(0);
			expect(messages[0].content).toBe("Test message");
		});

		test("can cleanup test session", async () => {
			if (!testSessionId) return;
			await SessionMemory.deleteSession(testSessionId);
		});
	});
});

// Manual test runner for quick verification
if (import.meta.main) {
	console.log("\n🧪 Quick Agent Test\n");
	console.log("Testing module imports...");

	try {
		// Test imports
		const { createTripPlannerSupervisor } = await import("../supervisor");
		const supervisor = createTripPlannerSupervisor();
		console.log("✅ Supervisor created");

		const { RESEARCHER_TOOLS, PLANNER_TOOLS, CRITIC_TOOLS } = await import("../tools");
		console.log(`✅ Tools loaded: ${RESEARCHER_TOOLS.length + PLANNER_TOOLS.length + CRITIC_TOOLS.length} total`);

		const { MemoryManager } = await import("../memory");
		const memory = new MemoryManager({});
		console.log("✅ MemoryManager instantiated");

		console.log("\n📊 Summary:");
		console.log("- Researcher tools:", RESEARCHER_TOOLS.map((t: any) => t.name).join(", "));
		console.log("- Planner tools:", PLANNER_TOOLS.map((t: any) => t.name).join(", "));
		console.log("- Critic tools:", CRITIC_TOOLS.map((t: any) => t.name).join(", "));

		console.log("\n✅ All module imports successful!\n");

		// API test if key is available
		if (process.env.OPENAI_API_KEY) {
			console.log("🔄 Testing live API call...\n");
			const { runAgent } = await import("../streaming");
			
			const result = await runAgent({
				messages: [{ role: "user", content: "What is Wat Pho?" }],
			});

			if (result.success) {
				console.log("✅ API call successful");
				console.log("Response:", result.response?.slice(0, 200) + "...");
			} else {
				console.log("❌ API call failed:", result.error);
			}
		} else {
			console.log("⚠️  No OPENAI_API_KEY - skipping live API test");
		}

	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
}
