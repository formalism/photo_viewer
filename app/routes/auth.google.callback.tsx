import type { Route } from "./+types/auth.google.callback";
import { authenticator } from "~/services/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  return authenticator.authenticate("google", request, {
    successRedirect: "/",
    failureRedirect: "/login?error=oauth",
  });
}
