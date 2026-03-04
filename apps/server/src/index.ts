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

// Serve OpenAPI JSON
app.get('/scalar', Scalar({ url: '/doc', theme: 'purple', pageTitle: 'My API Reference' }))
// Health check 
app.get("/", (c) => {
    return c.text("TripPlanner API - OK");
});

export default app;
