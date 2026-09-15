import { redirect } from "next/navigation";

/** The owner area moved to /console; old bookmarks keep working. */
export default function LegacyAdminRedirect() {
  redirect("/console");
}
