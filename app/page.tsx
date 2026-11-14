import { redirect } from "next/navigation";

// The proxy sends signed-in people to /cases before this renders; everyone else lands on sign-in.
export default function Home() {
  redirect("/signin");
}
