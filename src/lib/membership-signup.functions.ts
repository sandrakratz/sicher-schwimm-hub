import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

/**
 * Public server fn invoked from /mitgliedschaft right after the membership
 * application is stored. Creates an auth account that requires email
 * confirmation. After the user confirms, the admin can activate the profile.
 *
 * NOT auth-protected: the antragsteller is not signed in. We mitigate abuse
 * by requiring a matching memberships row created within the last 10 minutes
 * for the supplied email.
 */
export const submitMembershipSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email().max(255),
      first_name: z.string().trim().min(1).max(100),
      last_name: z.string().trim().min(1).max(100),
      password: z.string().min(8).max(72).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Anti-abuse: require a recent matching membership application
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .ilike("email", data.email)
      .gte("created_at", tenMinAgo)
      .limit(1)
      .maybeSingle();
    if (!recent) {
      throw new Response("Kein passender Mitgliedsantrag gefunden.", { status: 400 });
    }

    // Already has an auth account?
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const exists = list?.users?.some(u => (u.email || "").toLowerCase() === data.email.toLowerCase());
    if (exists) return { status: "exists" as const };

    const userProvidedPassword = !!data.password;
    const password = data.password ?? `${crypto.randomUUID()}${crypto.randomUUID()}`;

    // Use the standard signUp() flow via an anon client so the auth hook
    // sends the German signup confirmation email. admin.createUser() does
    // NOT trigger any email, which is why no confirmation arrived previously.
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await anon.auth.signUp({
      email: data.email,
      password,
      options: {
        data: { first_name: data.first_name, last_name: data.last_name },
        emailRedirectTo: "https://sicher-schwimmen.com/auth?pending=1",
      },
    });
    if (error) {
      console.error("[membership-signup.signUp]", error);
      throw new Response(error.message, { status: 500 });
    }

    // If user did NOT supply a password, also send a recovery email so they
    // can set their own password after confirming.
    if (!userProvidedPassword) {
      await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
        redirectTo: "https://sicher-schwimmen.com/reset-password",
      }).catch((e) => console.warn("[membership-signup.resetEmail]", e));
    }

    return { status: userProvidedPassword ? ("created" as const) : ("created_no_password" as const) };
  });
