
import React from 'react';

interface VoiceOrbProps {
  isListening: boolean;
  isProcessing: boolean;
  onClick: () => void;
}

const HackerGlider = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    {/* The Glider: The Universal Hacker Emblem */}
    <circle cx="50" cy="20" r="10" />
    <circle cx="80" cy="50" r="10" />
    <circle cx="20" cy="80" r="10" />
    <circle cx="50" cy="80" r="10" />
    <circle cx="80" cy="80" r="10" />
  </svg>
);

const VoiceOrb: React.FC<VoiceOrbProps> = ({ isListening, isProcessing, onClick }) => {
  return (
    <div className="relative flex items-center justify-center h-80 w-80 mx-auto">
      {/* Outer Rotating Ring */}
      <div className={`absolute inset-0 rounded-full border border-cyan-500/20 ${isListening || isProcessing ? 'animate-spin' : ''}`} style={{ animationDuration: '10s' }} />
      
      {/* Middle Glowing Ring */}
      <div className={`absolute inset-8 rounded-full border-2 border-cyan-500/10 ${isListening ? 'animate-pulse scale-110' : ''}`} />

      {/* Pulsing Aura */}
      {(isListening || isProcessing) && (
        <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
      )}
      
      {/* Main Core */}
      <button
        onClick={onClick}
        className={`relative z-10 w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700 shadow-[0_0_50px_rgba(0,242,255,0.2)] overflow-hidden group ${
          isListening 
            ? 'bg-red-500/20 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]' 
            : isProcessing
              ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.4)]'
              : 'bg-black/40 border border-white/20 hover:border-cyan-400/50'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent pointer-events-none opacity-50" />
        
        <div className="relative flex flex-col items-center justify-center">
           {isListening ? (
             <div className="flex gap-1.5 items-center h-12">
               {[1.2, 2.5, 1.8, 3, 2.2, 1.5, 2.8].map((h, i) => (
                 <div 
                   key={i} 
                   className="w-1.5 bg-red-400 rounded-full animate-bounce" 
                   style={{ 
                     height: `${h * 12}px`,
                     animationDelay: `${i * 0.05}s`,
                     animationDuration: '0.6s'
                    }} 
                 />
               ))}
             </div>
           ) : isProcessing ? (
             <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                <div className="w-8 h-8 border-2 border-cyan-500/40 border-b-cyan-300 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
             </div>
           ) : (
             <div className="flex flex-col items-center space-y-2">
                <HackerGlider className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,242,255,0.6)]" />
                <div className="flex flex-col items-center">
                  <span className="text-cyan-400 font-mono text-2xl font-bold tracking-tighter group-hover:scale-110 transition-transform glitch-text">sudO</span>
                  <div className="h-0.5 w-8 bg-cyan-500/50 mt-1 rounded-full" />
                </div>
             </div>
           )}
        </div>
      </button>

      {/* Bottom Status Text */}
      <div className="absolute -bottom-12 left-0 right-0 flex flex-col items-center space-y-1">
        <div className={`text-[10px] font-mono tracking-[0.3em] uppercase transition-colors duration-500 ${isListening ? 'text-red-400' : isProcessing ? 'text-cyan-400' : 'text-cyan-400/60'}`}>
          {isListening ? 'Input: Active' : isProcessing ? 'Processing...' : 'Core: Idle'}
        </div>
        {!isListening && !isProcessing && (
          <div className="text-[10px] text-white/20 uppercase font-bold tracking-widest animate-pulse">
            Terminal Access Ready
          </div>
        )}
      </div>
      <style>{`
        .glitch-text {
          position: relative;
        }
        .glitch-text::before {
          content: attr(data-text);
          position: absolute;
          left: -2px;
          text-shadow: 1px 0 #ff00c1;
          background: transparent;
          overflow: hidden;
          clip: rect(0, 900px, 0, 0);
          animation: noise-anim 2s infinite linear alternate-reverse;
        }
        @keyframes noise-anim {
          0% { clip: rect(10px, 9999px, 50px, 0); }
          100% { clip: rect(30px, 9999px, 80px, 0); }
        }
      `}</style>
    </div>
  );
};

export default VoiceOrb;
