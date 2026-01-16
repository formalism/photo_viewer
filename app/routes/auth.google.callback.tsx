import type { Route } from "./+types/auth.google.callback";
import { authenticator } from "~/services/auth.server";
import { getSession, commitSession } from "~/services/session.server";
import { redirect } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const user = await authenticator.authenticate("google", request);
    const session = await getSession(request);
    session.set("user", user);
    return redirect("/", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (error) {
    console.error("Auth error:", error);
    if (error instanceof Response) throw error;
    return redirect("/login?error=oauth");
  }
}