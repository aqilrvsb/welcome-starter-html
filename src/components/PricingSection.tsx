import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star, Zap, Crown } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "29",
    period: "month",
    description: "Perfect for small businesses getting started with AI voice agents",
    icon: Zap,
    popular: false,
    features: [
      "Up to 1,000 calls/month",
      "2 AI voice agents",
      "Basic analytics dashboard",
      "Email support",
      "Standard voice quality",
      "Basic integrations",
      "30-day call history"
    ]
  },
  {
    name: "Professional",
    price: "99",
    period: "month",
    description: "Ideal for growing businesses with higher call volumes",
    icon: Star,
    popular: true,
    features: [
      "Up to 10,000 calls/month",
      "10 AI voice agents",
      "Advanced analytics & reporting",
      "Priority support",
      "Premium voice quality",
      "Advanced integrations",
      "90-day call history",
      "Custom voice training",
      "A/B testing tools"
    ]
  },
  {
    name: "Enterprise",
    price: "299",
    period: "month",
    description: "For large organizations requiring maximum flexibility and control",
    icon: Crown,
    popular: false,
    features: [
      "Unlimited calls",
      "Unlimited AI voice agents",
      "Enterprise analytics suite",
      "24/7 dedicated support",
      "Ultra-premium voice quality",
      "Custom integrations",
      "Unlimited call history",
      "Advanced AI model access",
      "White-label options",
      "SLA guarantees",
      "Custom deployment"
    ]
  }
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 lg:py-32 section-gradient">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
            Simple, Transparent{" "}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              Pricing
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Choose the perfect plan for your business. Start free, upgrade anytime. 
            No hidden fees, no long-term contracts.
          </p>
          
          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-card rounded-lg p-1 card-soft border border-border/50">
            <button className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md transition-smooth">
              Monthly
            </button>
            <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth">
              Annual (Save 20%)
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index}
              className={`relative card-soft hover:card-large transition-smooth hover:-translate-y-2 ${
                plan.popular 
                  ? 'border-primary ring-2 ring-primary/20 bg-card' 
                  : 'border-border bg-card/50 backdrop-blur-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="hero-gradient px-4 py-1 rounded-full text-white text-sm font-semibold">
                    Most Popular
                  </div>
                </div>
              )}

              <CardHeader className="text-center pb-8">
                <div className={`${plan.popular ? 'hero-gradient' : 'bg-secondary'} p-3 rounded-lg w-fit mx-auto mb-4`}>
                  <plan.icon className={`h-6 w-6 ${plan.popular ? 'text-white' : 'text-secondary-foreground'}`} />
                </div>
                
                <CardTitle className="text-2xl font-bold text-foreground">
                  {plan.name}
                </CardTitle>
                
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
                
                <CardDescription className="mt-2 text-muted-foreground">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <Button 
                  variant={plan.popular ? "hero" : "outline"} 
                  size="lg" 
                  className="w-full"
                  onClick={() => {
                    if (plan.name === "Enterprise") {
                      // Navigate to contact or open email client
                      window.location.href = 'mailto:sales@voiceaipro.com';
                    } else {
                      // Navigate to signup with plan parameter
                      window.location.href = `/signup?plan=${plan.name.toLowerCase()}`;
                    }
                  }}
                >
                  {plan.name === "Enterprise" ? "Contact Sales" : "Start Free Trial"}
                </Button>

                <div className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-3">
                      <Check className="h-4 w-4 text-success flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-8">
            Frequently Asked Questions
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
            <div className="bg-card rounded-lg p-6 card-soft border border-border/50">
              <h4 className="font-semibold text-foreground mb-2">Can I change plans anytime?</h4>
              <p className="text-muted-foreground text-sm">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 card-soft border border-border/50">
              <h4 className="font-semibold text-foreground mb-2">What's included in the free trial?</h4>
              <p className="text-muted-foreground text-sm">
                14-day free trial with full access to Professional features, including 1,000 free calls.
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 card-soft border border-border/50">
              <h4 className="font-semibold text-foreground mb-2">Do you offer custom pricing?</h4>
              <p className="text-muted-foreground text-sm">
                Yes, we offer custom Enterprise plans for organizations with specific requirements.
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 card-soft border border-border/50">
              <h4 className="font-semibold text-foreground mb-2">What payment methods do you accept?</h4>
              <p className="text-muted-foreground text-sm">
                We accept all major credit cards, PayPal, and wire transfers for Enterprise customers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}