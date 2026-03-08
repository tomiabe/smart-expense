import ExpenseDetector from "@/components/ExpenseDetector"

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden bg-zinc-50 dark:bg-black font-sans selection:bg-primary/30">

      {/* Decorative Apple-style mesh gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[60vh] bg-gradient-to-br from-blue-200/50 via-purple-200/30 to-rose-200/30 dark:from-blue-900/10 dark:via-purple-900/10 dark:to-rose-900/10 blur-[120px] pointer-events-none rounded-[100%]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-tl from-indigo-200/50 to-transparent dark:from-indigo-900/20 blur-[120px] pointer-events-none rounded-full" />

      <div className="relative z-10 flex flex-col items-center pt-24 pb-16 px-6 lg:px-8">
        <div className="text-center w-full max-w-2xl mb-12">
          <div className="inline-flex items-center px-4 py-1.5 mb-8 border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-full text-xs font-semibold tracking-wide uppercase text-zinc-600 dark:text-zinc-400 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-purple-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
            Powered by Deepmind AI
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-zinc-900 dark:text-white mb-6">
            Smart Expense <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Detective</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 font-medium mb-8 max-w-xl mx-auto leading-relaxed">
            Upload your statement and instantly discover hidden subscriptions, unexpected fees, and duplicate charges.
          </p>
        </div>

        <ExpenseDetector />
      </div>

      <div className="relative z-10 mt-4 pb-12 flex flex-wrap justify-center gap-6 text-sm text-zinc-500 dark:text-zinc-400 font-medium px-4">
        <p className="flex items-center gap-2"><span className="text-lg">🧠</span> AI-powered logic</p>
        <p className="flex items-center gap-2"><span className="text-lg">🛡️</span> Encrypted data transit</p>
        <p className="flex items-center gap-2"><span className="text-lg">⚡</span> Instant insights</p>
      </div>
    </main>
  );
}
