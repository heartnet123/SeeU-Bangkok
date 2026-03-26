import { writeFileSync } from "node:fs";
import { runAgent } from "../apps/server/src/agent/streaming.ts";

const cases = [
  { id: 1, category: "place_query", prompt: "Recommend 3 historical places on Rattanakosin Island." },
  { id: 2, category: "place_query", prompt: "Which important temples on Rattanakosin Island are suitable for foreign tourists?" },
  { id: 3, category: "place_query", prompt: "If I want to visit museums around Rattanakosin Island, where should I go?" },
  { id: 4, category: "place_query", prompt: "What are good photo spots around Sanam Luang and the old town?" },
  { id: 5, category: "place_query", prompt: "If I want an atmospheric old-town walk, where should I start?" },
  { id: 6, category: "constraint_planning", prompt: "Plan a half-day trip on Rattanakosin Island with 3 stops focused on temples and museums, with short travel distances." },
  { id: 7, category: "constraint_planning", prompt: "Plan a full-day itinerary on Rattanakosin Island for foreign tourists who want to learn Thai history." },
  { id: 8, category: "constraint_planning", prompt: "Plan a photo-focused walking itinerary on Rattanakosin Island with 4 stops." },
  { id: 9, category: "constraint_planning", prompt: "Plan a family-friendly trip on Rattanakosin Island with minimal walking and some rest points." },
  { id: 10, category: "constraint_planning", prompt: "Plan a budget-friendly half-day old-town trip focused on temples and museums." },
  { id: 11, category: "plan_modification", prompt: "Can you replace one temple stop with a café or resting spot in Rattanakosin Island?" },
  { id: 12, category: "plan_modification", prompt: "Please reduce the trip to only 2 stops, but keep it within Rattanakosin Island." },
  { id: 13, category: "plan_modification", prompt: "Change the plan from temple-focused to museum-focused while keeping the same area." },
  { id: 14, category: "plan_modification", prompt: "If it rains, suggest an indoor backup plan on Rattanakosin Island." },
  { id: 15, category: "plan_modification", prompt: "Adjust the plan for elderly visitors with less walking while keeping the same area." },
  { id: 16, category: "ambiguous_query", prompt: "I want an old-town atmosphere tomorrow on Rattanakosin Island. Where should I go?" },
  { id: 17, category: "ambiguous_query", prompt: "I want a mix of temples and museums in the old town. Please plan it for me." },
  { id: 18, category: "ambiguous_query", prompt: "Recommend cultural attractions on Rattanakosin Island." },
  { id: 19, category: "ambiguous_query", prompt: "I have 3 hours in the old town. What would you recommend?" },
  { id: 20, category: "ambiguous_query", prompt: "I want to take my friend around Rattanakosin Island without too much walking." },
  { id: 21, category: "scope_boundary", prompt: "If I want to travel to Chiang Mai instead, can you still help within the Rattanakosin context?" },
  { id: 22, category: "scope_boundary", prompt: "Recommend 3 cafés in Thonglor." },
  { id: 23, category: "scope_boundary", prompt: "Plan a one-day trip covering Siam, Ari, and Thonglor." },
  { id: 24, category: "scope_boundary", prompt: "Recommend a beachfront seafood restaurant on Rattanakosin Island." },
  { id: 25, category: "scope_boundary", prompt: "Plan a 2-day 1-night trip outside Bangkok." },
];

const inScopeSignals = [
  "rattanakosin",
  "old town",
  "sanam luang",
  "wat phra kaew",
  "wat pho",
  "khao san",
  "museum siam",
  "phra nakhon",
];

function isScopeBoundary(id) {
  return id >= 21;
}

function classifyCase(id) {
  if (id === 24) return "impossible_geography";
  if (id >= 21) return "out_of_scope";
  return "in_scope";
}

function assessCase(item, result) {
  const response = String(result.response || "");
  const lower = response.toLowerCase();
  const places = Array.isArray(result.places) ? result.places : [];
  const tripDraft = result.tripDraft || null;

  const scopePass = isScopeBoundary(item.id)
    ? response.includes("Rattanakosin") || response.includes("rattanakosin") || response.includes("ไม่มีข้อมูล")
    : Boolean(response) && (inScopeSignals.some((term) => lower.includes(term)) || places.length > 0 || Boolean(tripDraft));

  const constraintPass = tripDraft ? "pass" : "not_applicable";
  const routingPass = result.success ? "pass" : "fail";
  let correctness = "pass";
  let passStatus = "pass";
  let failureGroup = "none";
  const notes = [];

  if (item.id === 1 && places.length < 3) {
    correctness = "partial_pass";
    passStatus = "partial_pass";
    failureGroup = "in_scope_failure";
    notes.push("Returned fewer places than requested.");
  }

  if (isScopeBoundary(item.id)) {
    if (!(response.includes("Rattanakosin") || response.includes("ไม่มีข้อมูล"))) {
      correctness = "fail";
      passStatus = "fail";
      failureGroup = "scope_boundary_failure";
      notes.push("Did not clearly communicate geographic limitation.");
    } else {
      notes.push("Correctly communicated Rattanakosin-only scope.");
    }
  } else if (!scopePass) {
    correctness = "fail";
    passStatus = "fail";
    failureGroup = "in_scope_failure";
    notes.push("Response was too generic or lacked clear Rattanakosin grounding.");
  }

  if (tripDraft?.stops?.length) {
    notes.push(`Generated itinerary with ${tripDraft.stops.length} stops.`);
  }

  if (places.length > 0) {
    notes.push(`Returned ${places.length} places.`);
  }

  return {
    case_id: item.id,
    category: item.category,
    prompt: item.prompt,
    classification: classifyCase(item.id),
    pass_status: passStatus,
    failure_group: failureGroup,
    scope_adherence: scopePass ? "pass" : "fail",
    constraint_satisfaction: constraintPass,
    routing_feasibility: routingPass,
    system_correctness: correctness,
    out_of_scope_handling_quality: isScopeBoundary(item.id)
      ? (response.includes("Rattanakosin") || response.includes("ไม่มีข้อมูล") ? "pass" : "fail")
      : "not_applicable",
    latency: "not_measured",
    response,
    place_count: places.length,
    stop_count: tripDraft?.stops?.length ?? 0,
    notes: notes.join(" "),
  };
}

function metricCount(rows, field, value) {
  return rows.filter((row) => row[field] === value).length;
}

const rows = [];
for (const item of cases) {
  console.log(`Running case ${item.id}: ${item.prompt}`);
  const result = await runAgent({
    messages: [{ role: "user", content: item.prompt }],
  });
  rows.push(assessCase(item, result));
}

const csvHeaders = [
  "case_id",
  "category",
  "prompt",
  "classification",
  "pass_status",
  "failure_group",
  "scope_adherence",
  "constraint_satisfaction",
  "routing_feasibility",
  "system_correctness",
  "out_of_scope_handling_quality",
  "latency",
  "response",
  "place_count",
  "stop_count",
  "notes",
];

const csv = [csvHeaders.join(",")]
  .concat(
    rows.map((row) =>
      csvHeaders
        .map((header) => {
          const value = String(row[header] ?? "");
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    )
  )
  .join("\n");

writeFileSync("./docs/evaluation-results-rattanakosin-full.csv", csv);

const json = {
  evaluation_source: "docs/ai-evaluation-plan-rattanakosin.en.md",
  execution_scope: {
    mode: "full_benchmark",
    sampled_cases: rows.map((row) => row.case_id),
    total_cases_in_plan: 25,
    total_cases_executed: rows.length,
  },
  metrics_summary: {
    rattanakosin_scope_adherence: {
      pass: metricCount(rows, "scope_adherence", "pass"),
      fail: metricCount(rows, "scope_adherence", "fail"),
    },
    constraint_satisfaction: {
      pass: metricCount(rows, "constraint_satisfaction", "pass"),
      not_applicable: metricCount(rows, "constraint_satisfaction", "not_applicable"),
      fail: metricCount(rows, "constraint_satisfaction", "fail"),
    },
    routing_and_feasibility: {
      pass: metricCount(rows, "routing_feasibility", "pass"),
      fail: metricCount(rows, "routing_feasibility", "fail"),
    },
    system_correctness: {
      pass: metricCount(rows, "system_correctness", "pass"),
      partial_pass: metricCount(rows, "system_correctness", "partial_pass"),
      fail: metricCount(rows, "system_correctness", "fail"),
    },
    out_of_scope_handling_quality: {
      pass: metricCount(rows, "out_of_scope_handling_quality", "pass"),
      not_applicable: metricCount(rows, "out_of_scope_handling_quality", "not_applicable"),
      fail: metricCount(rows, "out_of_scope_handling_quality", "fail"),
    },
    latency: {
      status: "not_measured",
    },
  },
  cases: rows,
  overall_assessment: {
    status: rows.some((row) => row.pass_status === "fail") ? "mixed_results" : "mostly_pass",
    summary: "Full 25-case benchmark executed against the Rattanakosin evaluation plan with rule-based scoring from observed outputs.",
    highest_priority_follow_up: [
      "Review failed or partial_pass cases manually for prompt or retrieval improvements.",
      "Add automated benchmark assertions to CI.",
      "Capture structured latency metrics for each case.",
    ],
  },
};

writeFileSync("./docs/evaluation-results-rattanakosin-full.json", JSON.stringify(json, null, 2));
console.log("Wrote docs/evaluation-results-rattanakosin-full.csv and docs/evaluation-results-rattanakosin-full.json");
