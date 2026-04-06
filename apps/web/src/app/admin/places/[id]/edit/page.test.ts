import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(join(import.meta.dir, "page.tsx"), "utf8");

describe("AdminEditPlacePage auth wiring", () => {
	test("includes bearer authorization on every admin API request", () => {
		expect(pageSource).toContain("const supabase = createClient()");
		expect(pageSource).toContain("const { data: { session } } = await supabase.auth.getSession()");
		expect(pageSource.match(/\.\.\.\(await getAuthHeaders\(\)\)/g)?.length).toBe(3);
	});
});
