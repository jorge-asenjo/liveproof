import { baseUrl } from "@/lib/paypal";
import { takeHandoff } from "@/lib/handoff";
import { setSeller } from "@/lib/session";

// Opened on the phone from the QR code shown on the computer.
export async function GET(_request: Request, { params }: RouteContext<"/go/[id]">) {
  const { id } = await params;
  const handoff = takeHandoff(id);
  if (!handoff) return Response.redirect(`${baseUrl()}/sell?login=qr`, 303);
  await setSeller(handoff.seller); // a fresh 2 h session on the phone
  return Response.redirect(`${baseUrl()}/sell?draft=${encodeURIComponent(handoff.draftId)}`, 303);
}
