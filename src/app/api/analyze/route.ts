import { generateObject } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
})

export const maxDuration = 60; // Allow enough time for LLM processing

const InsightSchema = z.object({
    type: z.enum(["subscription", "transport", "fee", "frequent"]),
    title: z.string().describe("A concise 2-4 word title, like 'Hidden Subscription' or 'Unexpected Bank Fees'"),
    description: z.string().describe("A short sentence explaining the insight, e.g., 'You paid ₦5,000 to Netflix 3 times.'"),
    totalAmount: z.number().describe("The total sum of money spent on this specific insight group"),
    count: z.number().describe("The number of times this specific expense occurred")
})

export async function POST(req: Request) {
    try {
        const { transactions } = await req.json()

        if (!transactions || transactions.length === 0) {
            return Response.json({ insights: [], totalSpent: 0 })
        }

        const totalSpent = transactions.reduce((acc: number, tx: any) => acc + (tx.Amount || 0), 0)

        // Only keep debits/spending — filter out obvious credits or income
        const debitsOnly = transactions.filter((t: any) => {
            const desc = (t.Description || "").toLowerCase()
            // Exclude typical inflow/credit descriptions
            const isCredit = desc.includes("salary") || desc.includes("inward") || desc.includes("credit alert") || desc.includes("reversal") || desc.includes("refund")
            return !isCredit
        })

        const totalSpentCalc = debitsOnly.reduce((acc: number, tx: any) => acc + (tx.Amount || 0), 0)

        // Send compact transaction data to LLM
        const compactTransactions = debitsOnly.map((t: any) => `${t.Date} | ${t.Description.substring(0, 80)} | ₦${t.Amount}`).join("\n")

        const { object } = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: z.object({
                insights: z.array(InsightSchema).describe("List of detected spending insights")
            }),
            prompt: `
You are an expert financial analyst AI reviewing a Nigerian bank statement. Your job is to identify specific spending patterns with accuracy.

CRITICAL RULES:
1. ONLY analyze OUTGOING charges (debits). IGNORE any incoming transfers, credits, salaries, or money received.
2. When you see a POS/WEB PURCHASE, look at the raw string AFTER the reference number to find the REAL merchant name. For example:
   - "POS/WEB PURCHASE TRANSACTION -539802-BOLT_PAYU LAGOS ISLAND" → merchant is "Bolt"
   - "POS/WEB PURCHASE TRANSACTION -402671-ROYAL PRINCE GLOBAL" → merchant is "Royal Prince"
   - "POS/WEB PURCHASE TRANSACTION -510470-Mega Chicken Restaur" → merchant is "Mega Chicken"
3. NEVER group all POS transactions together under a generic label — always extract the real merchant name.
4. For Airtime purchases (USAT), group them all together under "Airtime Top-ups".
5. For NIBSS outward transfers with different recipients/amounts, list major ones separately if they are large (>5000). Small ones can be grouped.
6. For bank fees (SMS, stamp duty, maintenance), group them under "Bank Fees".
7. For transport (Bolt, Uber, Rida), group all rides per company and give clear insight like "You spent ₦X on 8 Bolt rides."
8. Be very precise: recalculate totalAmount and count by summing the actual transactions from the list.
9. Express all amounts in ₦ (Naira).

Transactions to analyze:
${compactTransactions}
`
        })

        // Use calculated total from debitsOnly
        return Response.json({ insights: object.insights, totalSpent: totalSpentCalc })
    } catch (error) {
        console.error("AI Analysis Error:", error)
        return Response.json({ error: "Failed to process data" }, { status: 500 })
    }
}
