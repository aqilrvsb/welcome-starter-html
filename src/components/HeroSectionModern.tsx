import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, CheckCircle2 } from "lucide-react";

export function HeroSectionModern() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 left-1/2 w-96 h-96 bg-pink-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMDUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left Column - Content */}
            <div className="space-y-8 animate-fade-in-up">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  AI-Powered Voice Technology
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-5xl lg:text-7xl font-black leading-tight">
                <span className="text-slate-900 dark:text-white">
                  Transform Your
                </span>
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
                  Customer Calls
                </span>
                <br />
                <span className="text-slate-900 dark:text-white">
                  with AI Agents
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Deploy intelligent voice agents that handle conversations naturally.
                <span className="font-semibold text-slate-900 dark:text-white"> Automate calls</span>,
                <span className="font-semibold text-slate-900 dark:text-white"> boost sales</span>, and
                <span className="font-semibold text-slate-900 dark:text-white"> delight customers</span> 24/7.
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap gap-3">
                {['No Coding Required', 'Deploy in Minutes', '99.9% Uptime'].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  size="lg"
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl shadow-blue-500/50 px-8 py-6 text-lg font-semibold rounded-2xl transition-all duration-300 hover:scale-105"
                  onClick={() => window.location.href = '/signup'}
                >
                  <span className="relative z-10 flex items-center">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-lg font-semibold rounded-2xl border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Zap className="mr-2 h-5 w-5" />
                  View Demo
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200 dark:border-slate-800">
                {[
                  { value: '10K+', label: 'Active Users' },
                  { value: '5M+', label: 'Calls Handled' },
                  { value: '50+', label: 'Languages' }
                ].map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <div className="text-3xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {stat.value}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column - Interactive Dashboard Preview */}
            <div className="relative animate-fade-in-up animation-delay-200">

              {/* Main Glass Card */}
              <div className="relative group">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-30 group-hover:opacity-50 transition-opacity"></div>

                {/* Glass Card */}
                <div className="relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-3xl p-8 border border-white/20 dark:border-slate-700/50 shadow-2xl">

                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">AI Voice Agent</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Active & Learning</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Live</span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                      { label: 'Active Calls', value: '247', trend: '+12%', color: 'blue' },
                      { label: 'Avg Response', value: '1.8s', trend: '-35%', color: 'green' },
                      { label: 'Success Rate', value: '98.5%', trend: '+2.1%', color: 'purple' },
                      { label: 'Satisfaction', value: '4.9/5', trend: '+0.3', color: 'pink' }
                    ].map((metric) => (
                      <div key={metric.label} className="bg-slate-50/80 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">{metric.label}</div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-bold text-slate-900 dark:text-white">{metric.value}</span>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">{metric.trend}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Activity Wave */}
                  <div className="relative h-24 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 dark:border-purple-500/20 overflow-hidden">
                    <div className="absolute inset-0 flex items-end justify-around px-2 pb-2">
                      {[40, 65, 45, 80, 60, 90, 55, 70, 85, 50, 75, 95].map((height, i) => (
                        <div
                          key={i}
                          className="w-2 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full animate-pulse"
                          style={{
                            height: `${height}%`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Accent Cards */}
              <div className="absolute -top-8 -right-8 bg-gradient-to-br from-green-500 to-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-green-500/50 animate-float">
                <div className="text-xs font-medium opacity-90">Conversion Rate</div>
                <div className="text-2xl font-black">+127%</div>
              </div>

              <div className="absolute -bottom-8 -left-8 bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-float animation-delay-1000">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
                  <div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">AI Processing</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">1,247 calls/min</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-slate-400 dark:border-slate-600 flex justify-center p-2">
          <div className="w-1 h-2 bg-slate-400 dark:bg-slate-600 rounded-full animate-scroll"></div>
        </div>
      </div>
    </section>
  );
}
