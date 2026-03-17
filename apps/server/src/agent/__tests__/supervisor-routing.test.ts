import { describe, expect, test } from "bun:test";

async function loadSupervisorModule() {
	process.env.SUPABASE_URL ||= "https://example.supabase.co";
	process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
	process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
	process.env.OPENAI_API_KEY ||= "test-openai-key";
	return import("../supervisor");
}

describe("supervisor routing policy", () => {
	test("uses gpt-5-nano as the default supervisor model", async () => {
		const { DEFAULT_SUPERVISOR_MODEL } = await loadSupervisorModule();
		expect(DEFAULT_SUPERVISOR_MODEL).toBe("gpt-5-nano");
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
