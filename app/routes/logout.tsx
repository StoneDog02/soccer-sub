import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { createSupabase } from "~/lib/supabase.server";

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  await supabase.auth.signOut();
  throw redirect("/", { headers });
}

export async function loader() {
  throw redirect("/");
}
