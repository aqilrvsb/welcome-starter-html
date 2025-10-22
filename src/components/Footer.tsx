import { Bot, Github, Twitter, Linkedin, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="hero-gradient p-2 rounded-lg">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">VoiceAI Pro</span>
            </div>
            <p className="text-background/70 mb-6 leading-relaxed">
              The leading platform for building and deploying AI voice agents. 
              Transform your customer experience with intelligent automation.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-background/70 hover:text-background transition-smooth">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-background/70 hover:text-background transition-smooth">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="text-background/70 hover:text-background transition-smooth">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-background/70 hover:text-background transition-smooth">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="font-semibold text-background mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  API Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Integrations
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Templates
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="font-semibold text-background mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Press
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Partners
                </a>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="font-semibold text-background mb-4">Support</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Contact Support
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Status Page
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Security
                </a>
              </li>
              <li>
                <a href="#" className="text-background/70 hover:text-background transition-smooth">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-background/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-background/70 text-sm">
            © 2024 VoiceAI Pro. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-background/70 hover:text-background transition-smooth text-sm">
              Terms of Service
            </a>
            <a href="#" className="text-background/70 hover:text-background transition-smooth text-sm">
              Privacy Policy
            </a>
            <a href="#" className="text-background/70 hover:text-background transition-smooth text-sm">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}