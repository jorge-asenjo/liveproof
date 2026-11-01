// Claude reads the seller's pasted listing and returns structured fields plus one
// physical detail the seller should show on camera. Server-only.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claudeExtras, LISTING_MODEL } from "./claude";

export const ListingSchema = z.object({
  title: z.string().describe("Short item title, e.g. 'NVIDIA RTX 3080 Founders Edition'."),
  category: z.string().describe("Item category in 1-3 words, e.g. 'graphics card'."),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  price: z.number().nullable().describe("Asking price as a number, null if not stated."),
  currency: z.string().describe("ISO 4217 code. Use USD if not stated."),
  condition: z.string().nullable(),
  proof_detail: z
    .string()
    .describe(
      "One physical detail of this exact item that the seller can show on camera in a few seconds and that a stock photo would not show, e.g. 'the model sticker on the back of the card'. Under 12 words.",
    ),
});
export type Listing = z.infer<typeof ListingSchema>;

const SYSTEM = `You read second-hand marketplace listings (Reddit trading subs, Facebook Marketplace, forums) and extract the item being sold.
If the text lists several items, pick the main or most expensive one.
Only use information present in the text. Do not invent model numbers or prices.`;

export async function parseListing(text: string): Promise<Listing> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: LISTING_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: `<listing>\n${text}\n</listing>` }],
    output_config: { effort: "low", format: betaZodOutputFormat(ListingSchema) },
    ...claudeExtras(LISTING_MODEL),
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to read this listing");
  if (!response.parsed_output) throw new Error("Could not read the listing");
  return response.parsed_output;
}
