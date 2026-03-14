import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Scalar } from "@scalar/hono-api-reference";
import { appRouter } from "./routers/index";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	}),
);

// Mount all routes
app.route("/api", appRouter);

// OpenAPI document for Scalar
app.get("/doc", (c) => {
	return c.json({
		openapi: "3.1.0",
		info: {
			title: "TripPlanner API",
			version: "2.0.0",
			description: "Consolidated chat API through agent v2 supervisor.",
		},
		paths: {
			"/api/agent/v2": {
				post: {
					summary: "Agent v2 chat endpoint",
					description:
						"Single chat entrypoint for streaming and non-streaming supervisor execution.",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["messages"],
									properties: {
										messages: {
											type: "array",
											items: {
												type: "object",
												required: ["role", "content"],
												properties: {
													role: {
														type: "string",
														enum: ["system", "user", "assistant", "tool"],
													},
													content: { type: "string" },
													name: { type: "string" },
												},
											},
										},
										userLocation: {
											type: "object",
											properties: {
												lat: { type: "number" },
												lng: { type: "number" },
											},
										},
										sessionId: { type: "string" },
										stream: { type: "boolean", default: true },
									},
								},
							},
						},
					},
					responses: {
						"200": {
							description: "Successful response (SSE stream or JSON).",
						},
					},
				},
			},
			"/api/agent/v2/health": {
				get: {
					summary: "Agent v2 health",
					responses: { "200": { description: "OK" } },
				},
			},
			"/api/agent/v2/agents": {
				get: {
					summary: "List agent v2 supervisor agents",
					responses: { "200": { description: "OK" } },
				},
			},
		},
	});
});

// Serve OpenAPI JSON
app.get("/scalar", Scalar({ url: "/doc", theme: "purple", pageTitle: "TripPlanner API Reference" }));
// Health check 
app.get("/", (c) => {
	return c.text("TripPlanner API - OK");
});

const idleTimeout = Number(process.env.BUN_IDLE_TIMEOUT ?? "120");

export default {
	fetch: app.fetch,
	idleTimeout: Number.isFinite(idleTimeout) && idleTimeout > 0 ? idleTimeout : 120,
};
