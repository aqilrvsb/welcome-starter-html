import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, RotateCw, Download, Volume2 } from "lucide-react";

interface AudioPlayerDialogProps {
  recordingUrl: string;
  triggerButton: React.ReactNode;
  title?: string;
}

export function AudioPlayerDialog({ recordingUrl, triggerButton, title = "Rakaman Panggilan" }: AudioPlayerDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      // Reset playing state if play fails
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = Math.min(audio.currentTime + 10, duration);
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = Math.max(audio.currentTime - 10, 0);
  };

  const downloadRecording = () => {
    try {
      // Simple download - HTTPS allows direct access
      const link = document.createElement('a');
      link.href = recordingUrl;
      link.download = `recording-${Date.now()}.wav`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      setError('Gagal memuat turun rakaman.');
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getAudioMimeType = (url: string) => {
    const clean = url.split('?')[0] || '';
    const ext = clean.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      case 'm4a':
        return 'audio/mp4';
      default:
        return 'audio/mpeg';
    }
  };

  // Load audio directly - HTTPS works without credentials
  const loadAudio = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Loading audio from:', recordingUrl);

      // Just set the URL directly - browser will handle HTTPS
      setBlobUrl(recordingUrl);

      // Wait a bit for audio to load
      setTimeout(() => {
        const a = audioRef.current;
        if (a) {
          a.currentTime = 0;
          a.play().then(() => setIsPlaying(true)).catch((e) => {
            console.error('Autoplay failed:', e);
            setIsPlaying(false);
          });
        }
      }, 100);
    } catch (err) {
      console.error('Failed to load audio:', err);
      setError('Gagal memuat rakaman. Sila cuba muat turun.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup blob URL when component unmounts or URL changes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) {
        loadAudio();
      } else {
        const a = audioRef.current;
        if (a) a.pause();
        setIsPlaying(false);
        // Cleanup blob URL
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          setBlobUrl(null);
        }
      }
    }}>
      <DialogTrigger asChild>
        {triggerButton}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" aria-describedby="audio-dialog-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription id="audio-dialog-desc" className="sr-only">
            Pemutar rakaman panggilan dengan kawalan main, langkau, dan volum.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <audio
            ref={audioRef}
            preload="metadata"
            playsInline
            className="hidden"
            src={blobUrl || undefined}
            onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
            onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              console.error('Audio playback error:', e);
              setError('Gagal memainkan audio.');
            }}
          />

          {isLoading && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Memuat rakaman...
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive text-center">
              {error}
            </div>
          )}
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={skipBackward}
              className="flex-shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={togglePlayPause}
              size="lg"
              className="flex-shrink-0"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={skipForward}
              className="flex-shrink-0"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[volume]}
              max={1}
              step={0.1}
              onValueChange={handleVolumeChange}
              className="flex-1"
            />
          </div>

          {/* Download Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={downloadRecording}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Muat Turun Rakaman
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}