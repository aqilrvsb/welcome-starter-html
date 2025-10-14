import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Bot, 
  Zap, 
  Shield, 
  BarChart3, 
  Globe, 
  Headphones, 
  Settings, 
  Clock,
  Users,
  PhoneCall,
  Brain,
  Mic
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Intelligent AI Agents",
    description: "Advanced conversational AI powered by GPT-4 and Claude, capable of handling complex customer interactions with human-like responses."
  },
  {
    icon: Zap,
    title: "Lightning Fast Setup",
    description: "Deploy your voice agent in under 5 minutes. No technical expertise required - just configure settings and you're live."
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-grade encryption, SOC 2 compliant infrastructure, and comprehensive data protection to keep your business secure."
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Real-time insights into call performance, customer sentiment, conversion rates, and detailed conversation analytics."
  },
  {
    icon: Globe,
    title: "Multi-Language Support",
    description: "Support for 50+ languages with native-quality voice synthesis and automatic language detection."
  },
  {
    icon: Headphones,
    title: "24/7 Customer Support",
    description: "Round-the-clock support from our expert team to help you optimize your voice agents for maximum performance."
  },
  {
    icon: Settings,
    title: "Flexible Configuration",
    description: "Customize every aspect of your agent's personality, voice, and behavior with our intuitive configuration interface."
  },
  {
    icon: Clock,
    title: "Always Available",
    description: "Your AI agents work 24/7/365 without breaks, ensuring your customers always get immediate assistance."
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Multi-user workspace with role-based permissions, shared templates, and collaborative agent development."
  },
  {
    icon: PhoneCall,
    title: "Omnichannel Integration",
    description: "Seamlessly integrate with your existing phone systems, CRM, and customer support platforms."
  },
  {
    icon: Brain,
    title: "Smart Learning",
    description: "Agents continuously improve through machine learning, getting better at handling your specific use cases over time."
  },
  {
    icon: Mic,
    title: "Premium Voice Quality",
    description: "Crystal-clear voice synthesis with multiple voice options, adjustable speed, pitch, and emotional tone."
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              Scale Your Business
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our comprehensive platform provides all the tools and features you need to build, 
            deploy, and manage AI voice agents that deliver exceptional customer experiences.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="card-soft hover:card-medium transition-smooth hover:-translate-y-1 border-0 bg-card/50 backdrop-blur-sm"
            >
              <CardHeader>
                <div className="hero-gradient p-3 rounded-lg w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl font-semibold text-foreground">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-primary/10 to-primary-light/10 rounded-2xl p-8 lg:p-12 card-soft">
            <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-4">
              Ready to Transform Your Customer Experience?
            </h3>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Join thousands of businesses already using VoiceAI Pro to deliver 
              exceptional customer service and drive revenue growth.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="hero"
                size="lg"
                className="hover:scale-105"
                onClick={() => window.location.href = '/signup'}
              >
                Start Free Trial
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="hover:bg-primary/5"
                onClick={() => {
                  // Add scheduling functionality or navigate to contact
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}