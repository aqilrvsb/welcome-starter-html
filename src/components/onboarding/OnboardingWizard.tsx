import React from 'react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  X, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Zap,
  Settings,
  BarChart3,
  CheckCircle,
  Bot,
  Phone,
  FileText,
  Users
} from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export const OnboardingWizard: React.FC = () => {
  const {
    isOnboardingOpen,
    currentStep,
    totalSteps,
    hideOnboarding,
    nextStep,
    prevStep,
    completeOnboarding,
  } = useOnboarding();

  const [dontShowAgain, setDontShowAgain] = useState(false);
  const progress = (currentStep / totalSteps) * 100;

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem('onboarding_dont_show_again', 'true');
    }
    completeOnboarding();
  };

  const handleComplete = () => {
    if (dontShowAgain) {
      localStorage.setItem('onboarding_dont_show_again', 'true');
    }
    completeOnboarding();
  };

  const steps = [
    {
      id: 1,
      title: "Selamat Datang ke AI Call VAPI",
      content: (
        <div className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-4">Selamat Datang!</h3>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Anda telah memasuki platform AI Voice Agent yang paling canggih. 
              Platform ini membolehkan anda membuat panggilan automatik yang cerdas 
              untuk sales, customer service, dan pelbagai kegunaan lain.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card className="p-4">
              <Bot className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">AI Voice Agent</p>
              <p className="text-xs text-muted-foreground">Suara natural seperti manusia</p>
            </Card>
            <Card className="p-4">
              <Phone className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Batch Calling</p>
              <p className="text-xs text-muted-foreground">Panggilan pukal serentak</p>
            </Card>
            <Card className="p-4">
              <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Analytics</p>
              <p className="text-xs text-muted-foreground">Laporan prestasi terperinci</p>
            </Card>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: "Setup Prompts & Make Calls",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
              <Zap className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-xl font-bold mb-2">Get Started dengan AI Calls</h3>
            <p className="text-muted-foreground">
              Ikuti langkah mudah ini untuk memulakan panggilan automatik pertama anda.
            </p>
          </div>
          
          <div className="bg-muted/50 p-6 rounded-lg">
            <h4 className="font-semibold mb-4 flex items-center">
              <CheckCircle className="h-5 w-5 text-success mr-2" />
              Langkah untuk memulakan:
            </h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-0.5">1</Badge>
                <div>
                  <p className="font-medium">Setup API Keys & Phone Config</p>
                  <p className="text-sm text-muted-foreground">Konfigurasi VAPI API Key dan Twilio credentials</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-0.5">2</Badge>
                <div>
                  <p className="font-medium">Create Prompt</p>
                  <p className="text-sm text-muted-foreground">Buat skrip percakapan AI di halaman Prompts</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-0.5">3</Badge>
                <div>
                  <p className="font-medium">Start Call</p>
                  <p className="text-sm text-muted-foreground">Mulakan panggilan di halaman Contacts</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Button asChild className="mt-4" variant="outline">
              <Link to="/prompts">
                <FileText className="mr-2 h-4 w-4" />
                Create Prompt
              </Link>
            </Button>
            <Button asChild className="mt-4">
              <Link to="/contacts">
                <Users className="mr-2 h-4 w-4" />
                Start Call
              </Link>
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: "Setup Prompt & Voice",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <Settings className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">Konfigurasi Prompt & Voice</h3>
            <p className="text-muted-foreground">
              Tetapkan skrip percakapan dan pilih suara AI yang sesuai untuk campaign anda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <FileText className="h-8 w-8 text-primary mb-4" />
              <h4 className="font-semibold mb-2">Prompt Management</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Buat dan urus skrip percakapan AI. Setiap prompt mengandungi:
              </p>
              <ul className="text-sm space-y-1">
                <li>• System prompt (arahan kepada AI)</li>
                <li>• First message (pembukaan panggilan)</li>
                <li>• Flow percakapan</li>
              </ul>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to="/prompts">Urus Prompts</Link>
              </Button>
            </Card>

            <Card className="p-6">
              <Bot className="h-8 w-8 text-primary mb-4" />
              <h4 className="font-semibold mb-2">Voice Configuration</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Pilih dan laraskan suara AI untuk campaign:
                (Optional)
              </p>
              <ul className="text-sm space-y-1">
                <li>• Pilih voice ID (11Labs)</li>
                <li>• Laras kelajuan suara</li>
                <li>• Set stability & clarity</li>
              </ul>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to="/settings">Voice Settings</Link>
              </Button>
            </Card>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Tips Penting</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Pastikan anda sudah setup API keys dan phone configuration di Settings 
                  sebelum memulakan campaign pertama.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      title: "Review Call Logs & Analytics",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">Pantau Prestasi Campaign</h3>
            <p className="text-muted-foreground">
              Analisis mendalam tentang prestasi panggilan dan hasil campaign anda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h4 className="font-semibold mb-4 flex items-center">
                <Phone className="h-5 w-5 text-primary mr-2" />
                Call Logs
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span>Status panggilan</span>
                  <Badge variant="outline">Real-time</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Durasi panggilan</span>
                  <span className="text-muted-foreground">Terperinci</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Rekod audio</span>
                  <span className="text-muted-foreground">Boleh main</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Transkrip lengkap</span>
                  <span className="text-muted-foreground">AI powered</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to="/call-logs">Lihat Call Logs</Link>
              </Button>
            </Card>

            <Card className="p-6">
              <h4 className="font-semibold mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 text-primary mr-2" />
                Dashboard Analytics
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span>Success rate</span>
                  <span className="text-green-600 font-medium">Peratusan</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Average duration</span>
                  <span className="text-muted-foreground">Purata masa</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total campaigns</span>
                  <span className="text-muted-foreground">Jumlah</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Cost tracking</span>
                  <span className="text-muted-foreground">Per panggilan</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            </Card>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Dashboard Metrics</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Metrics akan kemas kini secara real-time selepas panggilan bermula. 
                  Success rate dikira berdasarkan panggilan yang berjaya disambungkan dan selesai.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      title: "Selesai & Ready!",
      content: (
        <div className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-success/10 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-4">Tahniah! Setup Lengkap</h3>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Anda kini sudah bersedia untuk menggunakan AI Call VAPI sepenuhnya. 
              Platform ini akan membantu anda mengautomatikkan panggilan dan 
              meningkatkan produktiviti perniagaan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <Card className="p-6 text-left">
              <h4 className="font-semibold mb-3 flex items-center">
                <Zap className="h-5 w-5 text-primary mr-2" />
                Seterusnya, anda boleh:
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Buat campaign batch call pertama</li>
                <li>• Setup API keys dan phone config</li>
                <li>• Test dengan beberapa nombor</li>
                <li>• Analisis hasil di dashboard</li>
              </ul>
            </Card>

            <Card className="p-6 text-left">
              <h4 className="font-semibold mb-3 flex items-center">
                <Bot className="h-5 w-5 text-primary mr-2" />
                Tips untuk bermula:
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Mulakan dengan campaign kecil</li>
                <li>• Test prompt dengan nombor sendiri</li>
                <li>• Monitor call logs dengan teliti</li>
                <li>• Laras berdasarkan feedback</li>
              </ul>
            </Card>
          </div>

          <div className="flex justify-center space-x-4 mt-8">
            <Button asChild size="lg">
              <Link to="/contacts">
                <Users className="mr-2 h-5 w-5" />
                Mulakan Campaign
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/dashboard">
                <BarChart3 className="mr-2 h-5 w-5" />
                Lihat Dashboard
              </Link>
            </Button>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps.find(step => step.id === currentStep);

  if (!isOnboardingOpen) return null;

  return (
    <Dialog open={isOnboardingOpen} onOpenChange={hideOnboarding}>
      <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-muted/30">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">{currentStep}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">{currentStepData?.title}</h2>
                <p className="text-sm text-muted-foreground">
                  Step {currentStep} of {totalSteps}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-muted/20">
          <Progress value={progress} className="w-full" />
        </div>

        {/* Content */}
        <div className="p-8">
          {currentStepData?.content}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-4 p-6 border-t bg-muted/30">
          {/* Don't show again checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="dont-show-again" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            />
            <label 
              htmlFor="dont-show-again" 
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Jangan tunjukkan lagi
            </label>
          </div>
          
          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center space-x-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full ${
                    step <= currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            {currentStep === totalSteps ? (
              <Button onClick={handleComplete} className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>Complete</span>
              </Button>
            ) : (
              <Button onClick={nextStep} className="flex items-center space-x-2">
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};