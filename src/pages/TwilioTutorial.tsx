import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import twilioStep1 from "@/assets/twilio-step1.jpg";
import twilioStep2 from "@/assets/twilio-step2.jpg";
import twilioStep3 from "@/assets/twilio-step3.jpg";
import twilioStep4 from "@/assets/twilio-step4.jpg";
import twilioStep5 from "@/assets/twilio-step5.jpg";

export default function TwilioTutorial() {
  const navigate = useNavigate();

  const steps = [
    {
      title: "Step 1: Buy a Number",
      description: "Lepas register, tekan dekat 'Buy a Number' dan pilih nombor US untuk guna",
      image: twilioStep1,
    },
    {
      title: "Step 2: Review & Buy",
      description: "Tick 'I agree' dan tekan 'Buy' untuk dapatkan nombor trial",
      image: twilioStep2,
    },
    {
      title: "Step 3: Search Geo Permissions",
      description: "Lepas settle buy number, search 'geo permission' untuk set permissions",
      image: twilioStep3,
    },
    {
      title: "Step 4: Enable Malaysia",
      description: "Tick Malaysia dan klik 'Save' untuk allow nombor US call nombor Malaysia",
      image: twilioStep4,
    },
    {
      title: "Step 5: Copy Credentials",
      description: "Twilio Account SID, Twilio Auth Token dan US number boleh ambil dekat sini untuk masukkan dalam Phone Configuration",
      image: twilioStep5,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="outline"
          onClick={() => navigate("/settings")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Settings
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Tutorial: Dapatkan Free Trial Twilio Number
          </h1>
          <p className="text-muted-foreground">
            Ikuti langkah-langkah di bawah untuk dapatkan nombor Twilio percuma
          </p>
        </div>

        <div className="space-y-8">
          {steps.map((step, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <img
                  src={step.image}
                  alt={step.title}
                  className="w-full rounded-lg border shadow-sm"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Selesai!</CardTitle>
            <CardDescription>
              Selepas dapat credentials, masukkan ke dalam Phone Configuration untuk mula menggunakan perkhidmatan call.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/settings")}>
              Pergi ke Phone Configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
