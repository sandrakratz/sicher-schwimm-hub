import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lovable/email/queue/process")({
  server: {
    handlers: {
      GET: async () => new Response("Email queue route is available", { status: 200 }),
      POST: async () => new Response("Email queue route is available", { status: 200 }),
    },
  },
});