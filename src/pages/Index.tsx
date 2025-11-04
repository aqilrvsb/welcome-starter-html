import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Phone, Zap, Globe, Users, TrendingUp, Shield, Clock, ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm fixed w-full top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-6 w-6 text-[#7959ef]" />
            <span className="text-xl font-bold text-gray-900">SifuCall</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-[#7959ef] transition-colors">Features</a>
            <a href="#usecases" className="text-gray-600 hover:text-[#7959ef] transition-colors">Use Cases</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" className="text-gray-600 hover:text-[#7959ef]">
                Log In
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-[#7959ef] hover:bg-[#6849df] text-white font-semibold">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-block mb-4 px-4 py-2 bg-purple-50 rounded-full">
            <span className="text-[#7959ef] text-sm font-semibold">🎉 AI-Powered Voice Assistant</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Automate Your Calls with{" "}
            <span className="text-[#7959ef]">AI Voice Agents</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Scale your business with intelligent voice automation. Handle thousands of calls simultaneously with human-like AI agents.
          </p>
          <div className="flex items-center justify-center gap-4 mb-12">
            <Link to="/signup">
              <Button size="lg" className="bg-[#7959ef] hover:bg-[#6849df] text-white font-semibold text-lg px-8 py-6">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-[#7959ef] text-[#7959ef] hover:bg-purple-50 text-lg px-8 py-6">
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </div>

          {/* Demo Preview */}
          <div className="relative max-w-3xl mx-auto">
            <div className="rounded-2xl border-4 border-gray-200 bg-white shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-[#7959ef] to-[#5939cf] p-12 text-white">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <Phone className="h-8 w-8 animate-pulse" />
                  <span className="text-2xl font-semibold">Live Call in Progress</span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-left">
                  <p className="text-lg mb-2">🤖 AI Agent: "Hello! How can I help you today?"</p>
                  <p className="text-lg opacity-80">👤 Customer: "I'd like to schedule an appointment..."</p>
                </div>
              </div>
            </div>
            {/* Floating Stats */}
            <div className="absolute -top-4 -left-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-gray-700">150+ Calls Active</span>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
              <div className="text-sm font-semibold text-gray-700">⚡ 0.3s Response Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Modern Businesses
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to automate and scale your voice operations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: <Zap className="h-8 w-8 text-[#7959ef]" />,
                title: "Lightning Fast",
                description: "Sub-second response times with advanced AI models"
              },
              {
                icon: <Globe className="h-8 w-8 text-[#7959ef]" />,
                title: "Multi-Language",
                description: "Support for 50+ languages and dialects"
              },
              {
                icon: <Users className="h-8 w-8 text-[#7959ef]" />,
                title: "Unlimited Scale",
                description: "Handle thousands of concurrent calls effortlessly"
              },
              {
                icon: <TrendingUp className="h-8 w-8 text-[#7959ef]" />,
                title: "Real-time Analytics",
                description: "Track performance metrics and conversation insights"
              },
              {
                icon: <Shield className="h-8 w-8 text-[#7959ef]" />,
                title: "Enterprise Security",
                description: "SOC 2 compliant with end-to-end encryption"
              },
              {
                icon: <Clock className="h-8 w-8 text-[#7959ef]" />,
                title: "24/7 Availability",
                description: "Never miss a call with always-on AI agents"
              }
            ].map((feature, index) => (
              <Card key={index} className="p-6 border-gray-200 hover:shadow-lg transition-shadow bg-white">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="usecases" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Built for Every Industry
            </h2>
            <p className="text-xl text-gray-600">
              From sales to support, automate your voice workflows
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              {
                title: "Sales & Lead Qualification",
                points: ["Qualify leads 24/7", "Schedule appointments automatically", "Follow up with prospects instantly"]
              },
              {
                title: "Customer Support",
                points: ["Handle common queries", "Escalate to human agents when needed", "Provide instant responses"]
              },
              {
                title: "Appointment Booking",
                points: ["Book appointments seamlessly", "Send reminders automatically", "Reduce no-shows by 40%"]
              },
              {
                title: "Surveys & Feedback",
                points: ["Collect customer feedback", "Conduct phone surveys at scale", "Analyze sentiment in real-time"]
              }
            ].map((useCase, index) => (
              <Card key={index} className="p-8 border-gray-200 bg-gradient-to-br from-white to-purple-50">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{useCase.title}</h3>
                <ul className="space-y-3">
                  {useCase.points.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-[#01df4a] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{point}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#7959ef] to-[#5939cf]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses automating their voice operations with AI
          </p>
          <Link to="/signup">
            <Button size="lg" className="bg-white text-[#7959ef] hover:bg-gray-100 font-semibold text-lg px-8 py-6">
              Start Free Trial Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Phone className="h-6 w-6 text-[#7959ef]" />
                <span className="text-xl font-bold">SifuCall</span>
              </div>
              <p className="text-gray-400">
                AI-powered voice automation for modern businesses
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-[#7959ef]">Features</a></li>
                <li><a href="#usecases" className="hover:text-[#7959ef]">Use Cases</a></li>
                <li><a href="#" className="hover:text-[#7959ef]">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-[#7959ef]">About</a></li>
                <li><a href="#" className="hover:text-[#7959ef]">Blog</a></li>
                <li><a href="#" className="hover:text-[#7959ef]">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-[#7959ef]">Privacy</a></li>
                <li><a href="#" className="hover:text-[#7959ef]">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 SifuCall. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
