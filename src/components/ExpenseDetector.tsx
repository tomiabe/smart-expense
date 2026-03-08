"use client"

import React, { useState, useRef, useEffect } from "react"
import Papa from "papaparse"
import { motion, AnimatePresence } from "framer-motion"
import { UploadCloud, CarFront, Tv, AlertCircle, Search, Repeat, ChevronRight, X, Calendar, DollarSign, FileText, Sparkles } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

type Transaction = {
    Date: string
    Description: string
    Amount: number
    Type: "credit" | "debit"
}

type Insight = {
    id: string
    type: "subscription" | "transport" | "fee" | "frequent"
    title: string
    description: string
    totalAmount: number
    count: number
    icon: React.ReactNode
    transactions?: Transaction[]
}

export default function ExpenseDetector() {
    const [loading, setLoading] = useState(false)
    const [insights, setInsights] = useState<Insight[]>([])
    const [totalSpent, setTotalSpent] = useState(0)
    const [fileName, setFileName] = useState("")
    const [userName, setUserName] = useState("")
    const [parsedTransactions, setParsedTransactions] = useState<Transaction[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [progress, setProgress] = useState(0)
    const [progressLabel, setProgressLabel] = useState("")
    const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const PROGRESS_STEPS = [
        { pct: 10, label: "Reading your statement..." },
        { pct: 28, label: "Parsing transactions..." },
        { pct: 46, label: "Sending to AI analyst..." },
        { pct: 62, label: "Detecting patterns..." },
        { pct: 78, label: "Identifying merchants..." },
        { pct: 91, label: "Finalising insights..." },
    ]

    useEffect(() => {
        if (!loading) {
            setProgress(0)
            setProgressLabel("")
            return
        }
        let step = 0
        setProgress(PROGRESS_STEPS[0].pct)
        setProgressLabel(PROGRESS_STEPS[0].label)

        const interval = setInterval(() => {
            step++
            if (step < PROGRESS_STEPS.length) {
                setProgress(PROGRESS_STEPS[step].pct)
                setProgressLabel(PROGRESS_STEPS[step].label)
            } else {
                clearInterval(interval)
            }
        }, 1800)

        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading])

    const openDrawer = (insight: Insight) => {
        setSelectedInsight(insight)
        setDrawerOpen(true)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        setFileName(file.name)

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            try {
                const pdfjsLib = await import("pdfjs-dist")
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

                const arrayBuffer = await file.arrayBuffer()
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

                const allTransactions: Transaction[] = []
                const allLines: string[] = []

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i)
                    const content = await page.getTextContent()

                    let lastY = -1
                    let currentLine = ""
                    const lines: string[] = []

                    for (const item of content.items as { str: string; transform: number[] }[]) {
                        if (!item.transform) continue
                        const y = Math.round(item.transform[5])
                        if (lastY !== -1 && Math.abs(lastY - y) > 5 && currentLine.trim()) {
                            lines.push(currentLine.trim())
                            currentLine = ""
                        }
                        currentLine += item.str + " "
                        lastY = y
                    }
                    if (currentLine.trim()) lines.push(currentLine.trim())
                    allLines.push(...lines)

                    // Try to extract account holder name from header lines
                    for (const line of lines) {
                        const nameMatch = line.match(/CUSTOMER STATEMENT[\s\n]+([A-Z ,]+)/i)
                        if (nameMatch) {
                            const raw = nameMatch[1].trim()
                            // Convert "ABE , KAYODE JESUTOMILAYO" → "Kayode"
                            const parts = raw.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean)
                            if (parts.length >= 2) {
                                setUserName(capitalize(parts[1].toLowerCase()))
                            }
                        }
                    }

                    let currentDate = "Unknown"
                    for (let j = 0; j < lines.length; j++) {
                        const line = lines[j]
                        const amountMatches = line.matchAll(/([\d,]+\.[\d]{2})/g)
                        const matchesArray = Array.from(amountMatches).map(m => parseFloat(m[1].replace(/,/g, '')))

                        const dateMatch = line.match(/(\d{1,2}[\\/\-][a-zA-Z]{3}[\\/\-]\d{2,4}|\d{1,2}[\\/\-]\d{1,2}[\\/\-]\d{2,4})/)
                        if (dateMatch) {
                            currentDate = dateMatch[0]
                        }

                        if (matchesArray.length > 0) {
                            const amtToUse = matchesArray[0]

                            if (amtToUse > 0 && amtToUse < 5000000) {
                                let desc = line.replace(/([\d,]+\.[\d]{2})/g, "").replace(currentDate, "").trim()
                                desc = desc.replace(/\b\d{5,}\b/g, "").trim()
                                desc = desc.replace(/^[^\w]+|[^\w]+$/g, "")

                                let extraDesc = ""
                                for (let k = j + 1; k < Math.min(j + 4, lines.length); k++) {
                                    if (lines[k].match(/([\d,]+\.[\d]{2})/) || lines[k].match(/(\d{1,2}[\\/\-][a-zA-Z]{3}[\\/\-]\d{2,4})/)) {
                                        break
                                    }
                                    extraDesc += " " + lines[k]
                                }

                                desc = (desc + extraDesc).trim()

                                if (desc.length > 3) {
                                    allTransactions.push({
                                        Date: currentDate,
                                        Description: desc.toLowerCase(),
                                        Amount: amtToUse,
                                        Type: "debit"
                                    })
                                }
                            }
                        }
                    }
                }

                setParsedTransactions(allTransactions)
                analyzeParsedTransactions(allTransactions)
            } catch (error) {
                console.error("Error parsing PDF:", error)
                setLoading(false)
            }
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    analyzeCSV(results.data as Record<string, string>[])
                },
            })
        }
    }

    const analyzeCSV = (data: Record<string, string>[]) => {
        const parsed: Transaction[] = []

        data.forEach((row) => {
            let desc = ""
            let amt = 0
            let date = ""

            for (const key of Object.keys(row)) {
                const lower = key.toLowerCase()
                if (lower.includes("desc") || lower.includes("narration") || lower.includes("detail") || lower.includes("particular")) {
                    desc = row[key]
                } else if (lower.includes("amount") || lower.includes("withdrawal") || lower.includes("debit") || lower.includes("value")) {
                    const val = String(row[key]).replace(/,/g, "").replace(/[^\d.-]/g, "")
                    if (val) amt = Math.abs(parseFloat(val))
                } else if (lower.includes("date") || lower.includes("time")) {
                    date = row[key]
                }
            }

            if (desc && amt > 0) {
                parsed.push({ Date: date, Description: desc.toLowerCase(), Amount: amt, Type: "debit" })
            }
        })

        setParsedTransactions(parsed)
        analyzeParsedTransactions(parsed)
    }

    const analyzeParsedTransactions = async (parsed: Transaction[]) => {
        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transactions: parsed })
            })

            if (!res.ok) throw new Error("Failed to analyze data")

            const { insights, totalSpent } = await res.json()

            // Map icons + attach matching raw transactions to each insight for the drawer
            const finalInsights = insights.map((i: any, idx: number) => {
                let icon = <Search className="w-5 h-5 text-yellow-500" />
                if (i.type === "subscription") icon = <Tv className="w-5 h-5 text-purple-500" />
                if (i.type === "transport") icon = <CarFront className="w-5 h-5 text-blue-500" />
                if (i.type === "fee") icon = <AlertCircle className="w-5 h-5 text-red-500" />
                if (i.type === "frequent") icon = <Repeat className="w-5 h-5 text-orange-500" />

                // Strict filtering using the AI-provided merchantKeyword
                const kw = (i.merchantKeyword || "").toLowerCase().trim()
                const matchingTxs = parsed.filter(tx => {
                    const desc = tx.Description.toLowerCase()
                    // Primary match: exact keyword present in description
                    if (kw && desc.includes(kw)) return true
                    // Secondary safety: amount matches exactly (useful for fixed fees like SMS)
                    if (tx.Amount === i.totalAmount / i.count && kw && desc.includes(kw.substring(0, 3))) return true
                    return false
                }).slice(0, 20)

                return { ...i, id: `ai-${idx}`, icon, transactions: matchingTxs }
            })

            setTotalSpent(totalSpent)
            setInsights(finalInsights.sort((a: Insight, b: Insight) => b.totalAmount - a.totalAmount))
        } catch (error) {
            console.error("Analysis error:", error)
            alert("Error analyzing statement with AI. Ensure your GEMINI_API_KEY is configured.")
        } finally {
            setLoading(false)
        }
    }

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

    const resetAll = () => {
        setInsights([])
        setTotalSpent(0)
        setFileName("")
        setUserName("")
        setParsedTransactions([])
    }

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8">
            {/* Upload state */}
            {insights.length === 0 && !loading && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center"
                >
                    <Card className="w-full max-w-md border-dashed border-2 border-gray-300 dark:border-gray-800 bg-white/40 dark:bg-black/40 backdrop-blur-xl transition-all hover:bg-white/60 dark:hover:bg-black/60 shadow-none">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                <UploadCloud className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold tracking-tight mb-2">Upload Bank Statement</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                                Upload your CSV or PDF statement to instantly detect hidden subscriptions, fees, and duplicate charges.
                            </p>
                            <Button onClick={() => fileInputRef.current?.click()} size="lg" className="rounded-full px-8 shadow-sm cursor-pointer">
                                Select File
                            </Button>
                            <input
                                type="file"
                                accept=".csv,.pdf"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Progress / Loading state */}
            {loading && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-24 space-y-6 w-full max-w-sm mx-auto"
                >
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                        <div className="absolute inset-[6px] rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{progress}%</span>
                        </div>
                    </div>

                    <div className="w-full space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span className="font-medium">{progressLabel}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-primary/10 overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                            />
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground text-center leading-relaxed">
                        AI is carefully reading your statement and<br />finding hidden patterns...
                    </p>
                </motion.div>
            )}

            {/* Results */}
            {insights.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                >
                    {/* Personalised header */}
                    <div className="rounded-2xl bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight mb-1">
                                    {userName ? `Hey ${userName}, here's what we found 🕵️` : "Detective Report 🕵️"}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    We detected <span className="font-semibold text-foreground">{insights.length} spending patterns</span> in{" "}
                                    <span className="font-semibold text-foreground">{fileName || "your statement"}</span>.
                                    Total outflows analysed:{" "}
                                    <span className="font-semibold text-red-500">₦{totalSpent.toLocaleString()}</span>
                                </p>
                            </div>
                            <Button variant="outline" onClick={resetAll} size="sm" className="rounded-full cursor-pointer shrink-0">
                                Start Over
                            </Button>
                        </div>

                        {/* Quick stat pills */}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {[
                                { label: "Subscriptions", val: insights.filter(i => i.type === "subscription").length, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" },
                                { label: "Transport", val: insights.filter(i => i.type === "transport").length, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
                                { label: "Bank Fees", val: insights.filter(i => i.type === "fee").length, color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
                                { label: "Patterns", val: insights.filter(i => i.type === "frequent").length, color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" },
                            ].filter(s => s.val > 0).map(stat => (
                                <span key={stat.label} className={`text-xs font-semibold px-3 py-1 rounded-full ${stat.color}`}>
                                    {stat.val} {stat.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Insight cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence>
                            {insights.map((insight, i) => (
                                <motion.div
                                    key={insight.id}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                >
                                    <button
                                        onClick={() => openDrawer(insight)}
                                        className="w-full h-full text-left cursor-pointer group"
                                        aria-label={`View details for ${insight.title}`}
                                    >
                                        <Card className="h-full bg-white/60 dark:bg-gray-950/60 backdrop-blur-lg border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] group-hover:-translate-y-0.5 duration-200">
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="p-2 bg-background/80 rounded-lg shadow-sm">
                                                        {insight.icon}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="secondary" className="rounded-full text-xs">
                                                            {insight.count} charges
                                                        </Badge>
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                                                    </div>
                                                </div>
                                                <CardTitle className="text-base font-semibold">{insight.title}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <CardDescription className="text-sm font-medium text-foreground/80">
                                                    {insight.description}
                                                </CardDescription>
                                                <div className="mt-4 pt-4 border-t border-border/50">
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Impact</p>
                                                    <p className="text-2xl font-bold tracking-tight text-red-500">
                                                        -₦{insight.totalAmount.toLocaleString()}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                                                    <FileText className="w-3 h-3" /> Tap to view individual charges
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}

            {/* Drawer — transaction breakdowns */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent side="right" className="w-[95%] sm:max-w-2xl overflow-y-auto p-0">
                    {selectedInsight && (
                        <div className="flex flex-col h-full gap-0">
                            <SheetHeader className="p-8 pb-6 border-b">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-muted rounded-lg">
                                        {selectedInsight.icon}
                                    </div>
                                    <div>
                                        <SheetTitle className="text-lg">{selectedInsight.title}</SheetTitle>
                                        <SheetDescription className="text-sm">{selectedInsight.description}</SheetDescription>
                                    </div>
                                </div>

                                {/* Summary pills */}
                                <div className="flex gap-3 mt-3">
                                    <div className="flex-1 bg-muted/60 rounded-xl p-3 text-center">
                                        <p className="text-xs text-muted-foreground mb-0.5">Total Spent</p>
                                        <p className="text-lg font-bold text-red-500">₦{selectedInsight.totalAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="flex-1 bg-muted/60 rounded-xl p-3 text-center">
                                        <p className="text-xs text-muted-foreground mb-0.5">Occurrences</p>
                                        <p className="text-lg font-bold">{selectedInsight.count}×</p>
                                    </div>
                                    <div className="flex-1 bg-muted/60 rounded-xl p-3 text-center">
                                        <p className="text-xs text-muted-foreground mb-0.5">Avg. Charge</p>
                                        <p className="text-lg font-bold">₦{Math.round(selectedInsight.totalAmount / selectedInsight.count).toLocaleString()}</p>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="p-8 pt-8 space-y-4">
                                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                    Matched Transactions
                                </p>

                                <div className="space-y-3">
                                    {selectedInsight.transactions && selectedInsight.transactions.length > 0 ? (
                                        selectedInsight.transactions.map((tx, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.04 }}
                                                className="flex flex-col gap-3 p-5 rounded-2xl bg-muted/30 border border-border/40"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Transaction Narration</p>
                                                        <p className="text-sm font-medium leading-relaxed capitalize">
                                                            {tx.Description}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-base font-bold text-red-500">-₦{tx.Amount.toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 pt-2 border-t border-border/20">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-3 h-3 text-muted-foreground" />
                                                        <p className="text-xs text-muted-foreground">{tx.Date}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="outline" className="text-[10px] uppercase tracking-tighter h-4 px-1.5 opacity-60">
                                                            Outgoing Debit
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 text-muted-foreground text-sm">
                                            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p>No individual transactions found for this pattern.</p>
                                            <p className="text-xs mt-1">The AI identified this from the full statement context.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
