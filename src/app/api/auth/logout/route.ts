import { baseUrl } from "@/lib/paypal";
import { clearSeller } from "@/lib/session";

export async function POST() {
  await clearSeller();
  return Response.redirect(`${baseUrl()}/`, 303);
}
