import { httpRouter } from "convex/server";
import { Webhook } from "svix";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    const body = await request.text();
    const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET as string);

    let event: { type: string; data: Record<string, unknown> };
    try {
      event = webhook.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as typeof event;
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      const data = event.data as {
        id: string;
        email_addresses: { id: string; email_address: string }[];
        primary_email_address_id: string;
        image_url?: string;
      };
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id,
      );
      if (primaryEmail) {
        await ctx.runMutation(internal.users.upsertFromClerk, {
          clerkId: data.id,
          email: primaryEmail.email_address,
          avatarUrl: data.image_url,
        });
      }
    } else if (event.type === "user.deleted") {
      const data = event.data as { id: string };
      await ctx.runMutation(internal.users.deleteFromClerk, {
        clerkId: data.id,
      });
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
