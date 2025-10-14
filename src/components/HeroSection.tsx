import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Star } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 section-gradient"></div>
      
      <div className="container mx-auto px-4 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <div className="relative z-10">
            {/* Trust Badge */}
            <div className="inline-flex items-center space-x-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-6">
              <Star className="h-4 w-4 fill-current" />
              <span>Trusted by 10,000+ businesses</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Build & Deploy{" "}
              <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                AI Voice Agents
              </span>{" "}
              with Ease
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Create powerful AI voice agents that handle customer calls, book appointments, 
              and engage users 24/7. No coding required - just configure, deploy, and scale.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button 
                variant="hero" 
                size="xl" 
                className="group"
                onClick={() => window.location.href = '/signup'}
              >
                Start Building Now
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline" 
                size="xl" 
                className="group"
                onClick={() => {
                  // Add demo video functionality later or scroll to demo
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <span className="text-2xl font-bold text-primary">99.9%</span>
                <span>Uptime</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-2xl font-bold text-primary">5M+</span>
                <span>Calls Handled</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-2xl font-bold text-primary">50+</span>
                <span>Languages</span>
              </div>
            </div>
          </div>

          {/* Right Column - Hero Image */}
          <div className="relative lg:ml-8">
            <div className="relative">
              <img
                src={heroImage}
                alt="AI Voice Agent Dashboard"
                className="w-full h-auto rounded-2xl card-large transform hover:scale-105 transition-smooth"
              />
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 bg-success text-success-foreground px-4 py-2 rounded-full text-sm font-semibold card-medium">
                Live Now ●
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-card text-foreground px-6 py-3 rounded-xl card-medium border border-border/50">
                <div className="text-sm text-muted-foreground">Active Agents</div>
                <div className="text-2xl font-bold text-primary">1,247</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 w-full">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-full h-12 lg:h-20 text-background"
        >
          <path
            d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z"
            fill="currentColor"
          ></path>
        </svg>
      </div>
    </section>
  );
}