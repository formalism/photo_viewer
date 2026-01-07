import { authenticator } from "~/auth.server";
import { getSession, commitSession } from "~/sessions.server";
import { redirect } from "react-router";
import type { Route } from "./+types/callback";

export async function loader({ request }: Route.LoaderArgs) {
  try {
      const user = await authenticator.authenticate("google", request);
      
      const session = await getSession(request.headers.get("Cookie"));
      session.set("user", user);
      
      return redirect("/db", {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      });
  } catch (error) {
      if (error instanceof Response) throw error; 
      
      console.error("Authentication failed", error);
      return redirect("/");
  }
}