# Bangkok Trip Planner

An AI-powered travel discovery platform for finding places, planning trips, and exploring Bangkok through an interactive map and chat experience. The project combines a Next.js web app, a Hono API, Supabase, and AI agent workflows to help users discover authentic local spots instead of only the usual tourist highlights.

## Overview

Bangkok Trip Planner is built as a monorepo with a user-facing web app and a backend API that supports place search, itinerary planning, saved trips, authentication, and streaming AI responses. The main experience blends map-based discovery with a conversational planner so users can ask natural-language questions like where to eat, what to visit nearby, or how to build a half-day itinerary.

## Problem & Solution

### The Problem

Travel planning for Bangkok is often fragmented. Users usually need to jump between maps, search results, blogs, and booking apps just to answer simple questions like:

- What interesting places are near me?
- Which places fit my budget and time?
- How do I combine several stops into one route?
- Where can I find hidden gems instead of generic recommendations?

This gets harder for users who want Thai and English support, location-aware recommendations, and a smoother way to save or revisit trips later.

### The Solution

This repo addresses the problem with a unified trip-planning flow:

- A map-first interface for browsing places visually
- An AI chat experience for natural-language discovery
- Saved itineraries and chat sessions for returning users
- Admin tools for maintaining place data
- Supabase-backed authentication and data storage
- Streaming responses so users can see the planner think and respond in real time

## The Problem

The core product gap is not just search, but context. A static directory of places does not answer intent well enough. Users need recommendations that consider category, proximity, budget, timing, and route structure at the same time. The project also has to support multilingual usage, mobile-friendly interactions, and responsive map UI without making the experience feel heavy or disconnected.

## The Solution

The application combines several layers:

1. Discovery layer: interactive maps, place browsing, filters, and place detail pages.
2. Planning layer: itinerary generation, trip drafts, saved trips, and route assembly.
3. Intelligence layer: chat and multi-agent workflows that use retrieval, search, and validation tools.
4. Persistence layer: Supabase authentication, user sessions, saved itineraries, and admin-managed content.

Together, these pieces turn Bangkok exploration into a guided workflow rather than a manual search process.

## Tech Stack

### Frontend

- Next.js 15 with the App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Mapbox GL JS for map rendering and interaction
- motion/react for animations
- shadcn/ui-style primitives and Radix-based components
- Sonner for toast notifications

### Backend

- Hono on Bun
- Server-Sent Events for streaming chat and agent responses
- Zod validation and Hono validators
- Supabase for auth and data access
- LangGraph-style multi-agent orchestration in the v2 agent flow

### Infrastructure and Tooling

- Turborepo monorepo orchestration
- Bun as the package manager and runtime
- Drizzle for database migration tooling
- Supercluster for map clustering

## Key Features

### AI Chat and Trip Planning

- Natural-language trip discovery
- Streaming AI responses over SSE
- Classic chat and agent-driven workflows
- Itinerary generation from conversational input
- Context-aware responses using search and retrieval tools

### Map-Based Exploration

- Interactive map view for exploring places visually
- Nearby place suggestions and place detail browsing
- Category filters for food, temples, cafes, parks, museums, nightlife, and attractions
- Responsive place cards and search flows

### Place and Trip Management

- Place listing and detail pages
- Saved trips and editable itineraries
- Chat session history for returning users
- Admin pages for place creation and updates

### Authentication and Personalization

- Supabase-backed login and session handling
- User-specific saved trips and planner state
- Location-aware recommendations when the browser location is available

### Multilingual Experience

- Thai and English support in the UI and product design
- Content and navigation that can adapt to the active locale

## Challenges & Learnings

### Challenges

- Keeping map interactions responsive while cleaning up Mapbox instances correctly
- Coordinating AI streaming, tool calls, and partial responses without breaking the UI state
- Balancing semantic search, nearby search, and itinerary generation in one flow
- Supporting authenticated features like saved trips and chat sessions without making the app feel gated
- Maintaining a consistent experience across desktop and mobile for map-heavy screens

### Learnings

- Streaming UI works best when the backend emits structured events instead of one large response
- Travel planning benefits from combining deterministic search with AI-generated context
- Map cleanup, state isolation, and careful loading states are essential for a stable experience
- A trip planner becomes more useful when it remembers sessions, preferences, and saved itineraries

## Project Structure

```text
apps/
	web/     # Next.js frontend
	server/  # Hono API backend
docs/      # Product, architecture, and evaluation documents
plans/     # Planning and refactoring notes
web-bundles/ # Agent and persona assets
```

## Getting Started

### Install Dependencies

```bash
bun install
```

### Run the Apps

```bash
bun run dev
```

### Run Individual Workspaces

```bash
bun run dev:web
bun run dev:server
```

### Build and Type Check

```bash
bun run build
bun run check-types
```

## Notes

- The web app runs on port `3001` in development.
- The backend exposes API routes for places, itineraries, sessions, auth, admin, tools, and the v2 agent workflow.
- Environment variables are required for Supabase, Mapbox, and server URLs.
