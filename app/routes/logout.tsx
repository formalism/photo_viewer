import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { destroySession, getSession } from "~/services/session.server";

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

export async function loader() {
  return redirect("/login");
}
