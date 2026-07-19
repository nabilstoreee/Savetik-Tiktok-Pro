import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface CustomVideoPlayerProps {
  src: string;
  thumbnail?: string;
}

export function CustomVideoPlayer({ src, thumbnail }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Auto-play on mount, and handle autoplay restrictions gracefully
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch((err) => {
        console.log("Autoplay was prevented, starting paused:", err);
        setIsPlaying(false);
      });
    }
  }, [src]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      videoRef.current.play().catch((err) => console.log(err));
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  // Automatically fade out centered controls when playing after a brief period
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isPlaying) {
      timeoutId = setTimeout(() => {
        setShowControls(false);
      }, 2000);
    } else {
      setShowControls(true);
    }
    return () => clearTimeout(timeoutId);
  }, [isPlaying]);

  const handleContainerClick = () => {
    if (isPlaying) {
      // Toggle controls visibility on click if playing
      setShowControls((prev) => !prev);
    } else {
      // If paused, click to play
      togglePlay();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full aspect-[9/16] bg-black border-4 border-black shadow-[4px_4px_0px_#000000] overflow-hidden group select-none cursor-pointer flex items-center justify-center max-h-[500px]"
      style={{ WebkitTouchCallout: "none" }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail}
        loop
        playsInline
        autoPlay
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full object-contain pointer-events-none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Play/Pause Overlay Button in the Center */}
      <div
        className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={togglePlay}
          className="w-16 h-16 rounded-full bg-black/45 border-4 border-white text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg cursor-pointer"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 text-white fill-white" />
          ) : (
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          )}
        </button>
      </div>

      {/* Volume / Mute Button at Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10">
        <button
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-black/60 border-2 border-white text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-red-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Muted Status Badge when muted */}
      {isMuted && (
        <div className="absolute top-4 left-4 bg-red-500/80 text-white font-mono text-[10px] font-bold px-2 py-1 uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000000]">
          MUTED
        </div>
      )}
    </div>
  );
}
