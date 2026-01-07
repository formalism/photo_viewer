import { redirect } from "react-router";
import { authenticator } from "~/auth.server";
import type { Route } from "./+types/google";

export async function loader({ request }: Route.LoaderArgs) {
  return await authenticator.authenticate("google", request);
}
