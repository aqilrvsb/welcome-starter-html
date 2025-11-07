import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function RecordingHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <span className="hidden sm:inline">Recording Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Cannot Play Recording? Follow These Steps
          </DialogTitle>
          <DialogDescription>
            If recordings fail to play, you need to trust the SSL certificate (one-time setup)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h3 className="font-semibold text-orange-900 mb-2">Why is this needed?</h3>
            <p className="text-orange-800">
              Recordings are stored on a server with a self-signed SSL certificate. Your browser blocks them by default for security. You need to manually trust the certificate once.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Step-by-Step Instructions:</h3>

            <div className="flex gap-3 p-3 bg-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-medium mb-1">Click on any "Play" button to get the recording URL</p>
                <p className="text-muted-foreground text-xs">The recording will fail to load - this is expected</p>
              </div>
            </div>

            <div className="flex gap-3 p-3 bg-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-medium mb-1">Copy the recording URL and open it in a NEW TAB</p>
                <p className="text-muted-foreground text-xs">Right-click the URL in browser console (F12) or check the error message</p>
              </div>
            </div>

            <div className="flex gap-3 p-3 bg-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-medium mb-1">You'll see a security warning page</p>
                <p className="text-muted-foreground text-xs">Chrome: "Your connection is not private" | Firefox: "Warning: Potential Security Risk"</p>
              </div>
            </div>

            <div className="flex gap-3 p-3 bg-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <p className="font-medium mb-1">Click "Advanced" or "Show Details"</p>
                <p className="text-muted-foreground text-xs">This reveals the option to proceed despite the warning</p>
              </div>
            </div>

            <div className="flex gap-3 p-3 bg-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                5
              </div>
              <div>
                <p className="font-medium mb-1">Click "Proceed" or "Accept the Risk and Continue"</p>
                <p className="text-muted-foreground text-xs">Your browser will now trust this server for recordings</p>
              </div>
            </div>

            <div className="flex gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <p className="font-medium text-green-900 mb-1">Done! Go back to Call Logs</p>
                <p className="text-green-700 text-xs">All recordings will now play automatically. You only need to do this once per server.</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> This is safe for your own recording server. The SSL certificate is self-signed but the server is secure.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
