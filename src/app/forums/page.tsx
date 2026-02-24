import { getForums } from "@/lib/queries";
import ForumsClient from "./ForumsClient";

export const dynamic = "force-dynamic";

export default function ForumsPage() {
  const forums = getForums();

  return <ForumsClient forums={forums} />;
}
