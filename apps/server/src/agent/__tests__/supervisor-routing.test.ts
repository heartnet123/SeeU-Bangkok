import { describe, expect, test } from "bun:test";

async function loadSupervisorModule() {
	process.env.SUPABASE_URL ||= "https://example.supabase.co";
	process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
	process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
	process.env.OPENAI_API_KEY ||= "test-openai-key";
	return import("../supervisor");
}

async function loadConfigModule() {
	process.env.SUPABASE_URL ||= "https://example.supabase.co";
	process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
	process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
	process.env.OPENAI_API_KEY ||= "test-openai-key";
	return import("../config");
}

describe("supervisor routing policy", () => {
	test("uses env-configured model (defaults to gpt-5-nano)", async () => {
		const { DEFAULT_AGENT_MODEL } = await loadConfigModule();
		// When OPENAI_CHAT_MODEL is not set, falls back to gpt-5-nano
		expect(DEFAULT_AGENT_MODEL).toBe(process.env.OPENAI_CHAT_MODEL ?? "gpt-5-nano");
	});

	test("routes simple informational queries directly to the researcher", async () => {
		const { classifyIntent, resolveAgentExecutionPlan } = await loadSupervisorModule();
		const plan = resolveAgentExecutionPlan([
			{ role: "user", content: "What temples are in Bangkok?" },
		]);

		expect(classifyIntent("What temples are in Bangkok?")).toBe("informational");
		expect(plan.mode).toBe("direct_researcher");
		expect(plan.includeCritic).toBe(false);
	});

	test("routes itinerary requests through the planner flow without critic by default", async () => {
		const { classifyIntent, resolveAgentExecutionPlan } = await loadSupervisorModule();
		const plan = resolveAgentExecutionPlan([
			{ role: "user", content: "Plan a half-day temple trip near Khao San Road" },
		]);

		expect(classifyIntent("Plan a half-day temple trip near Khao San Road")).toBe("itinerary");
		expect(plan.mode).toBe("supervisor");
		expect(plan.includeCritic).toBe(false);
	});

	test("enables critic only for explicit validation or revision requests", async () => {
		const { shouldUseCriticAgent, resolveAgentExecutionPlan } =
			await loadSupervisorModule();
		expect(shouldUseCriticAgent("Validate this itinerary for pacing")).toBe(true);
		expect(shouldUseCriticAgent("Revise this draft to be less rushed")).toBe(true);
		expect(shouldUseCriticAgent("Plan a temple trip for tomorrow")).toBe(false);

		const plan = resolveAgentExecutionPlan([
			{ role: "assistant", content: "{\"intent\":\"itinerary\",\"summary\":\"draft\"}" },
			{ role: "user", content: "Please validate and revise this itinerary" },
		]);

		expect(plan.mode).toBe("supervisor");
		expect(plan.includeCritic).toBe(true);
	});
});
