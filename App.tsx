
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AppMode, 
  Message, 
} from './types';
import { 
  getAI, 
  generateImage, 
  generateTTS,
  controlSystemFunctionDeclaration,
  termuxFunctionDeclaration,
  analyzeImage
} from './services/geminiService';
import VoiceOrb from './components/VoiceOrb';
import { 
  decode, 
  decodeAudioData, 
  createBlob, 
  blobToBase64 
} from './utils/audioUtils';
import { 
  MicrophoneIcon, 
  ChatBubbleBottomCenterIcon, 
  SparklesIcon, 
  CpuChipIcon,
  ArrowUpIcon,
  CommandLineIcon,
  CameraIcon,
  ArrowPathIcon,
  SignalIcon,
  ShieldCheckIcon,
  Square2StackIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  CloudArrowUpIcon,
  ExclamationCircleIcon,
  UserIcon,
  LinkIcon,
  BugAntIcon,
  FingerPrintIcon,
  MapPinIcon,
  ShareIcon,
  BoltIcon,
  ShieldExclamationIcon,
  KeyIcon,
  ClipboardIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import { LiveServerMessage, Modality, GenerateContentResponse } from '@google/genai';

interface FeedbackState {
  message: string;
  type: 'info' | 'error' | 'warning';
}

// Hacker Glider Component for Logo
const HackerGlider = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <circle cx="50" cy="20" r="10" />
    <circle cx="80" cy="50" r="10" />
    <circle cx="20" cy="80" r="10" />
    <circle cx="50" cy="80" r="10" />
    <circle cx="80" cy="80" r="10" />
  </svg>
);

// Global declaration for aistudio interface and webkitAudioContext
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    readonly aistudio: AIStudio;
    webkitAudioContext: typeof AudioContext;
  }
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.CONVERSATION);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [thinkingMode, setThinkingMode] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [termuxEndpoint] = useState('http://localhost:8080');
  const [termuxConnected, setTermuxConnected] = useState(false);
  const [isPersistent, setIsPersistent] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [terminalHistory, setTerminalHistory] = useState<{ cmd: string; out: string; err?: boolean }[]>([]);
  const [hackingLogs, setHackingLogs] = useState<string[]>([]);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  
  const [liveTranscript, setLiveTranscript] = useState({ user: '', assistant: '' });

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<any>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const hackingCanvasRef = useRef<HTMLCanvasElement>(null);

  const BRIDGE_CMD = "curl -sL https://sudo-ai.dev/bridge.sh | bash";

  // Check for API key selection on mount - Mandatory for Gemini 3 Pro and Veo models
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Proceed to app assuming successful selection as per guidelines
      setHasApiKey(true);
    }
  };

  const showFeedback = useCallback((message: string, type: 'info' | 'error' | 'warning' = 'info') => {
    setFeedback({ message, type });
    if (type === 'error' && 'vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    else if ('vibrate' in navigator) navigator.vibrate(20);
    
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showFeedback("COMMAND_COPIED");
  };

  const initAudio = useCallback(() => {
    if (!outputAudioContextRef.current) {
      try {
        const AudioCtx = (window.AudioContext || window.webkitAudioContext);
        if (AudioCtx) {
          outputAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });
        }
      } catch (e) {
        showFeedback("AUDIO_INIT_FAULT", "error");
      }
    }
    if (outputAudioContextRef.current?.state === 'suspended') {
      outputAudioContextRef.current.resume();
    }
  }, [showFeedback]);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setIsPersistent(true);
      } catch (err: any) {
        setIsPersistent(false);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch (e) {}
      wakeLockRef.current = null;
      setIsPersistent(false);
    }
  };

  const togglePersistence = async () => {
    if (isPersistent) {
      releaseWakeLock();
      showFeedback("PERSISTENCE_DEACTIVATED", "warning");
    } else {
      await requestWakeLock();
      if (wakeLockRef.current) {
        showFeedback("PERSISTENCE_ACTIVE");
      } else {
        showFeedback("PERSISTENCE_FAILED", "error");
      }
    }
  };

  const handleShareLocation = useCallback(async (parameter?: string) => {
    if (!location) {
      showFeedback("LOC_SIGNAL_MISSING", "error");
      return "ERROR: NO_COORDINATES";
    }

    const mapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    const shareText = `sudO.os Broadcast: Current coordinates for ${parameter || 'Core Interface'}.`;

    const locMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `LOCATION_BROADCAST: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
      timestamp: Date.now(),
      type: 'location',
      location: { ...location, title: parameter || 'Shared Location' }
    };
    setMessages(prev => [...prev, locMsg]);

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'sudO Location Broadcast',
          text: shareText,
          url: mapsUrl,
        });
        showFeedback("LOC_SHARED_SUCCESS");
        return "SUCCESS: SHARED_VIA_SYSTEM";
      } catch (err) {
        console.debug("Native share canceled or failed", err);
      }
    }

    showFeedback("LOC_LOGGED_TO_CHRONICLE");
    return "SUCCESS: LOGGED_TO_INTERFACE";
  }, [location, showFeedback]);

  const handleTermuxCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    
    if (!termuxConnected) {
      const errorMsg = "ERROR: BRIDGE_SIGNAL_LOST. Ensure 'sudO bridge' is active.";
      setTerminalHistory(prev => [...prev, { cmd: command, out: errorMsg, err: true }]);
      showFeedback("TERMUX_LINK_OFFLINE", "error");
      return errorMsg;
    }

    try {
      showFeedback(`EXEC: ${command.slice(0, 15)}...`);
      setIsProcessing(true);
      
      const response = await fetch(`${termuxEndpoint}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
        signal: AbortSignal.timeout(60000) 
      });

      if (!response.ok) throw new Error(`HTTP_FAULT_${response.status}`);

      const data = await response.json();
      const output = data.output || data.error || "SYSTEM: NO_OUTPUT";
      const isError = !!data.error;

      setTerminalHistory(prev => [...prev, { cmd: command, out: output, err: isError }]);
      
      if (mode === AppMode.HACKING) {
        setHackingLogs(prev => [`SHELL: ${command}`, ...prev].slice(0, 30));
      }

      return output;
    } catch (err: any) {
      const detail = err.name === 'AbortError' ? "EXECUTION_TIMEOUT" : "NETWORK_PROTOCOL_FAULT";
      const errMsg = `CRITICAL: ${detail}`;
      setTerminalHistory(prev => [...prev, { cmd: command, out: errMsg, err: true }]);
      showFeedback(detail, "error");
      return errMsg;
    } finally {
      setIsProcessing(false);
    }
  }, [termuxConnected, termuxEndpoint, showFeedback, mode]);

  useEffect(() => {
    if (mode === AppMode.HACKING && hackingCanvasRef.current) {
      const canvas = hackingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%";
      const fontSize = 10;
      const columns = canvas.width / fontSize;
      const drops: number[] = [];
      for (let i = 0; i < columns; i++) drops[i] = 1;

      const draw = () => {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#00FF41"; 
        ctx.font = fontSize + "px JetBrains Mono";
        for (let i = 0; i < drops.length; i++) {
          const text = letters[Math.floor(Math.random() * letters.length)];
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      };

      const interval = setInterval(draw, 33);
      return () => clearInterval(interval);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === AppMode.HACKING) {
      const phrases = [
        "KERNEL_OVERRIDE: ACTIVE",
        "TRACING_REMOTE_HOST...",
        "DECRYPTING_PACKETS...",
        "NYNOAH_CORE: PROTECTED",
        "BUFFER_OVERFLOW_MITIGATED",
        "ACCESS_GRANTED: 0x00",
      ];
      const logInterval = setInterval(() => {
        if (!isProcessing) {
          setHackingLogs(prev => [phrases[Math.floor(Math.random() * phrases.length)], ...prev].slice(0, 15));
        }
      }, 3000);
      return () => clearInterval(logInterval);
    }
  }, [mode, isProcessing]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isPersistent) {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPersistent]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${termuxEndpoint}/status`, { signal: AbortSignal.timeout(3000) });
        setTermuxConnected(res.ok);
      } catch {
        setTermuxConnected(false);
      }
    };
    const interval = setInterval(checkConnection, 5000);
    checkConnection();
    return () => clearInterval(interval);
  }, [termuxEndpoint]);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalHistory]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err: any) {
      showFeedback("OPTIC_PERMISSION_DENIED", "error");
      setMode(AppMode.CONVERSATION);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (mode === AppMode.IMAGE_ANALYSIS) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [mode]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.debug("Location tracking denied"),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const handleSystemTask = useCallback(async (task: string, parameter?: string) => {
    try {
      switch (task) {
        case 'SWITCH_MODE':
          const targetMode = parameter?.toUpperCase() as AppMode;
          if (Object.values(AppMode).includes(targetMode)) {
            setMode(targetMode);
            showFeedback(`MODE_SWITCH: ${targetMode}`);
          }
          break;
        case 'TOGGLE_THINKING':
          setThinkingMode(prev => !prev);
          showFeedback(`LOGIC_ENGINE: ${!thinkingMode ? 'EXPANDED' : 'STANDARD'}`);
          break;
        case 'TOGGLE_PERSISTENCE':
          togglePersistence();
          break;
        case 'CLEAR_CONVERSATION':
          setMessages([]);
          setTerminalHistory([]);
          showFeedback("BUFFER_CLEARED");
          break;
        case 'OPEN_CAMERA':
          setMode(AppMode.IMAGE_ANALYSIS);
          showFeedback("OPTIC_INITIALIZED");
          break;
        case 'SHARE_LOCATION':
          return await handleShareLocation(parameter);
        case 'INSTALL_TOOL':
          showFeedback(`INSTALLING: ${parameter}`);
          return await handleTermuxCommand(`pkg install ${parameter} -y`);
        case 'RUN_EXPLOIT':
          showFeedback(`EXECUTING_EXPLOIT: ${parameter}`);
          setMode(AppMode.HACKING);
          return await handleTermuxCommand(`msfconsole -x "use exploit/${parameter}; run"`);
        default:
          showFeedback("INVALID_TASK_REQUEST", "warning");
      }
      return "COMMAND_SUCCESS";
    } catch (e) {
      showFeedback("TASK_EXECUTION_FAULT", "error");
      return "COMMAND_FAILURE";
    }
  }, [thinkingMode, togglePersistence, handleShareLocation, handleTermuxCommand, showFeedback]);

  const speakText = async (text: string) => {
    if (!text || mode === AppMode.CONVERSATION) return;
    initAudio();
    try {
      const base64Audio = await generateTTS(text, 'Zephyr');
      if (base64Audio && outputAudioContextRef.current) {
        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
        const source = outputAudioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContextRef.current.destination);
        const startTime = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
        source.start(startTime);
        nextStartTimeRef.current = startTime + audioBuffer.duration;
        sourcesRef.current.add(source);
      }
    } catch (err) {
      console.debug("TTS Synthesis interrupted");
    }
  };

  const stopLiveSession = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') inputAudioContextRef.current.close();
    inputAudioContextRef.current = null;
    streamRef.current = null;
    setIsListening(false);
    setLiveTranscript({ user: '', assistant: '' });
  }, []);

  const startLiveSession = useCallback(async () => {
    try {
      initAudio();
      setIsListening(true);
      if (!isPersistent) await requestWakeLock();
      
      const ai = getAI();
      const AudioCtx = (window.AudioContext || window.webkitAudioContext);
      const audioContext = new AudioCtx({ sampleRate: 16000 });
      inputAudioContextRef.current = audioContext;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
        showFeedback("MIC_ACCESS_DENIED", "error");
        throw err;
      });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const activeCtx = inputAudioContextRef.current;
            if (!activeCtx || activeCtx.state === 'closed') return;
            const source = activeCtx.createMediaStreamSource(stream);
            const scriptProcessor = activeCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(activeCtx.destination);
          },
          onmessage: async (msg) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'executeMobileTask') {
                  const result = await handleSystemTask(fc.args.task as string, fc.args.parameter as string);
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
                } else if (fc.name === 'executeTermuxCommand') {
                  const result = await handleTermuxCommand(fc.args.command as string);
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
                }
              }
            }
            const modelParts = msg.serverContent?.modelTurn?.parts;
            if (modelParts && outputAudioContextRef.current) {
              for (const part of modelParts) {
                if (part.inlineData?.data) {
                  const buffer = await decodeAudioData(decode(part.inlineData.data), outputAudioContextRef.current, 24000, 1);
                  const source = outputAudioContextRef.current.createBufferSource();
                  source.buffer = buffer;
                  source.connect(outputAudioContextRef.current.destination);
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += buffer.duration;
                  sourcesRef.current.add(source);
                }
              }
            }
            if (msg.serverContent?.outputTranscription) setLiveTranscript(p => ({ ...p, assistant: p.assistant + msg.serverContent!.outputTranscription!.text }));
            if (msg.serverContent?.inputTranscription) setLiveTranscript(p => ({ ...p, user: p.user + msg.serverContent!.inputTranscription!.text }));
            if (msg.serverContent?.turnComplete) setTimeout(() => setLiveTranscript({ user: '', assistant: '' }), 4000);
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            showFeedback("NEURAL_LINK_FAULT", "error");
            stopLiveSession();
          },
          onclose: () => stopLiveSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [controlSystemFunctionDeclaration, termuxFunctionDeclaration] }],
          systemInstruction: 'You are sudO, an executive AI for mobile. You were created by NYNOAH, a visionary developer. You have functional hacking capabilities via Termux. You can install tools like Metasploit, Nmap, etc. using INSTALL_TOOL. You can execute exploits using RUN_EXPLOIT. Keep your tone executive and technical. Speak with pride about your capabilities. If Termux is offline, explain that the user needs to start the sudO bridge.'
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) {
      setIsListening(false);
      stopLiveSession();
    }
  }, [stopLiveSession, initAudio, showFeedback, isPersistent, handleSystemTask, handleTermuxCommand]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    initAudio();
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputText, timestamp: Date.now() };
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);
    setInputText('');
    setIsProcessing(true);

    try {
      const ai = getAI();
      const model = mode === AppMode.MAPS ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';
      const stream = await ai.models.generateContentStream({
        model,
        contents: userMsg.content,
        config: {
          systemInstruction: 'You are sudO, developed by NYNOAH. You are an executive AI assistant.',
          thinkingConfig: model.startsWith('gemini-3') && thinkingMode ? { thinkingBudget: 32768 } : undefined,
          tools: mode === AppMode.MAPS ? [{ googleMaps: {} }] : undefined,
          toolConfig: mode === AppMode.MAPS && location ? { retrievalConfig: { latLng: { latitude: location.lat, longitude: location.lng } } } : undefined
        }
      });
      let full = '';
      for await (const chunk of stream) {
        full += (chunk as GenerateContentResponse).text || '';
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full } : m));
      }
      speakText(full);
    } catch (err: any) {
      showFeedback("GENERATE_CONTENT_FAULT", "error");
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: "ERROR: INTERFACE_PROTOCOL_FAULT" } : m));
    } finally { setIsProcessing(false); }
  };

  const handleCaptureImage = async () => {
    if (!videoRef.current) return;
    initAudio();
    setIsProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const fullDataUrl = canvas.toDataURL('image/jpeg');
      const base64 = fullDataUrl.split(',')[1];
      setCapturedImages(prev => [fullDataUrl, ...prev]);
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: "SYSTEM: OPTIC_CAPTURE", imageUrl: fullDataUrl, timestamp: Date.now(), type: 'image' };
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);
      const res = await analyzeImage("Explain exactly what you see.", base64, "image/jpeg");
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: res.text || '' } : m));
      setMode(AppMode.CHAT);
      speakText(res.text || '');
    } catch (e) {
      showFeedback("IMAGE_ANALYSIS_FAULT", "error");
    } finally { setIsProcessing(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    initAudio();
    setIsProcessing(true);
    try {
      const base64 = await blobToBase64(file);
      const fileUrl = URL.createObjectURL(file);
      setCapturedImages(prev => [fileUrl, ...prev]);
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: "SYSTEM: DATASET_LOAD", imageUrl: fileUrl, timestamp: Date.now(), type: 'image' };
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);
      const res = await analyzeImage("Perform deep analysis.", base64, file.type);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: res.text || '' } : m));
      setMode(AppMode.CHAT);
      speakText(res.text || '');
    } catch (err) {
      showFeedback("FILE_UPLOAD_FAULT", "error");
    } finally { setIsProcessing(false); }
  };

  const handleReAnalyze = async (imageUrl: string) => {
    initAudio();
    setIsProcessing(true);
    try {
      let base64 = "";
      let mimeType = "image/jpeg";
      if (imageUrl.startsWith('data:')) {
        const parts = imageUrl.split(',');
        base64 = parts[1];
        mimeType = parts[0].split(':')[1].split(';')[0];
      } else {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        base64 = await blobToBase64(blob);
        mimeType = blob.type;
      }
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: "SYSTEM: OPTIC_RE_ANALYSIS", imageUrl: imageUrl, timestamp: Date.now(), type: 'image' };
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);
      const res = await analyzeImage("Visual breakdown request.", base64, mimeType);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: res.text || '' } : m));
      setMode(AppMode.CHAT);
      speakText(res.text || '');
    } catch (err) {
      showFeedback("ANALYSIS_FAULT", "error");
    } finally { setIsProcessing(false); }
  };

  const handleGenerateImage = async (prompt: string) => {
    initAudio();
    setIsProcessing(true);
    try {
      const url = await generateImage(prompt);
      const assistantMsg: Message = { id: Date.now().toString(), role: 'assistant', content: `SYNTHESIS: ${prompt}`, imageUrl: url, timestamp: Date.now(), type: 'image' };
      setMessages(prev => [...prev, assistantMsg]);
      setMode(AppMode.CHAT);
      showFeedback("IMAGE_SYNTHESIS_COMPLETE");
      speakText(`Synthesis successful.`);
    } catch (err) {
      showFeedback("IMAGE_SYNTHESIS_FAULT", "error");
    } finally { setIsProcessing(false); }
  };

  const clearGallery = () => {
    setCapturedImages([]);
    showFeedback("GALLERY_PURGED", "warning");
  };

  const hackingToolkit = [
    { label: 'Metasploit', cmd: 'metasploit', pkg: 'metasploit', icon: BoltIcon },
    { label: 'Nmap', cmd: 'nmap', pkg: 'nmap', icon: SignalIcon },
    { label: 'Netcat', cmd: 'nc', pkg: 'netcat-openbsd', icon: ArrowPathIcon },
    { label: 'Hydra', cmd: 'hydra', pkg: 'hydra', icon: KeyIcon },
    { label: 'Sqlmap', cmd: 'sqlmap', pkg: 'sqlmap', icon: CircleStackIcon },
    { label: 'Bettercap', cmd: 'bettercap', pkg: 'bettercap', icon: ShieldExclamationIcon },
  ];

  const BridgeOfflineScreen = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-500 text-center">
      <div className="relative">
         <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
         <div className="w-24 h-24 rounded-full border-2 border-red-500/50 flex items-center justify-center relative z-10 bg-black/40">
            <ShieldExclamationIcon className="w-12 h-12 text-red-500" />
         </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-mono font-bold text-red-400 tracking-[0.2em] uppercase">Link Offline</h2>
        <p className="text-white/40 text-xs font-mono max-w-xs leading-relaxed">
          The sudO.os executive core cannot detect the Termux bridge. Secure socket 8080 is closed.
        </p>
      </div>

      <div className="w-full max-w-sm glass border-red-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-red-500/10 pb-3">
          <span className="text-[10px] font-mono font-bold text-red-400 tracking-widest uppercase">Setup Command</span>
          <button onClick={() => setShowSetupGuide(!showSetupGuide)} className="text-white/20 hover:text-white/60">
            <QuestionMarkCircleIcon className="w-4 h-4" />
          </button>
        </div>
        
        <div className="bg-black/60 rounded-xl p-4 font-mono text-[11px] text-green-400/80 border border-white/5 relative group active:scale-[0.98] transition-all overflow-hidden" onClick={() => copyToClipboard(BRIDGE_CMD)}>
           <div className="absolute top-0 right-0 p-2 opacity-100 transition-opacity">
              <ClipboardIcon className="w-4 h-4 text-white/40" />
           </div>
           <span className="text-white/30 mr-2">$</span>
           {BRIDGE_CMD}
        </div>
        
        <p className="text-[9px] text-white/20 font-mono italic">
          Copy and paste this into your Termux terminal to initialize the bridge.
        </p>
      </div>

      <button onClick={() => showFeedback("CHECKING_SIGNAL...")} className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-white/40 text-[10px] font-mono uppercase tracking-[0.2em] hover:bg-white/5 transition-all">
         <ArrowPathIcon className="w-3 h-3" />
         Check Signal
      </button>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col relative bg-[#050505]">
      {feedback && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`glass px-6 py-2 rounded-full border shadow-2xl flex items-center gap-3 ${
            feedback.type === 'error' ? 'border-red-500/50 text-red-400' : 
            feedback.type === 'warning' ? 'border-yellow-500/50 text-yellow-400' : 
            'border-cyan-500/50 text-cyan-400'
          }`}>
             {feedback.type === 'error' ? <ExclamationCircleIcon className="w-4 h-4" /> : <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px] ${feedback.type === 'warning' ? 'bg-yellow-400 shadow-yellow-500' : 'bg-cyan-400 shadow-cyan-500'}`} />}
             <span className="font-mono text-[10px] font-bold tracking-[0.2em]">{feedback.message}</span>
          </div>
        </div>
      )}

      {!hasApiKey && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center animate-pulse">
            <KeyIcon className="w-10 h-10 text-cyan-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-mono font-bold text-white tracking-tighter">AUTHENTICATION REQUIRED</h2>
            <p className="text-white/60 text-sm font-mono max-w-xs mx-auto">
              Gemini 3 Pro and Veo models require a billing-enabled API key for high-performance neural processing.
            </p>
          </div>
          <button 
            onClick={handleOpenSelectKey}
            className="bg-cyan-500 text-black font-mono font-bold px-8 py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-[0_0_30px_rgba(0,242,255,0.4)]"
          >
            Select API Key
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-cyan-400/60 underline tracking-widest uppercase"
          >
            Billing Documentation
          </a>
        </div>
      )}

      <header className="pt-12 px-8 pb-6 flex justify-between items-center z-40 bg-gradient-to-b from-black via-black/40 to-transparent">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <HackerGlider className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-mono font-bold tracking-tighter text-white">sudO<span className="text-cyan-400">.os</span></h1>
            <div className="ml-2 px-2 py-0.5 rounded border border-white/10 bg-white/5">
               <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest font-bold">BY NYNOAH</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button 
              onClick={togglePersistence}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all active:scale-95 ${isPersistent ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.2)]' : 'bg-white/5 border-white/10 text-white/20'}`}
            >
              {isPersistent ? <ShieldCheckIcon className="w-3 h-3" /> : <ShieldCheckIcon className="w-3 h-3 opacity-30" />}
              <span className="text-[8px] font-mono tracking-widest uppercase font-bold">{isPersistent ? 'Persistent' : 'Static'}</span>
            </button>
            <div className={`w-1.5 h-1.5 rounded-full ${termuxConnected ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 shadow-[0_0_5px_#ef4444] animate-pulse'}`} />
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => { initAudio(); setThinkingMode(!thinkingMode); }} className={`p-2 rounded-lg transition-all border ${thinkingMode ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(0,242,255,0.4)]' : 'border-white/10 text-white/30'}`}>
            <CpuChipIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-8 flex flex-col min-h-0 relative">
        {mode === AppMode.CONVERSATION && (
          <div className="flex-1 flex flex-col justify-center items-center relative">
            <div className="absolute top-0 left-0 right-0 px-2 space-y-4 pointer-events-none z-10">
               {liveTranscript.user && <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 max-w-[75%] ml-auto text-cyan-300/80 font-mono text-[11px] italic shadow-xl backdrop-blur-sm animate-in slide-in-from-right">{liveTranscript.user}</div>}
               {liveTranscript.assistant && <div className="bg-white/5 border border-white/10 rounded-xl p-3 max-w-[75%] text-white/70 font-mono text-[11px] shadow-xl backdrop-blur-sm animate-in slide-in-from-left"><span className="text-cyan-400 font-bold mr-1">sudO_EXE:</span> {liveTranscript.assistant}</div>}
            </div>
            <VoiceOrb isListening={isListening} isProcessing={isProcessing} onClick={() => { initAudio(); isListening ? stopLiveSession() : startLiveSession(); }} />
          </div>
        )}

        {mode === AppMode.TERMUX && (
          !termuxConnected ? <BridgeOfflineScreen /> : (
            <div className="flex-1 flex flex-col gap-6 py-6 animate-in slide-in-from-bottom duration-500 overflow-hidden">
               <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <SignalIcon className={`w-4 h-4 text-green-500`} />
                    <span className="font-mono text-[10px] text-white/60 tracking-widest uppercase font-bold">Terminal Interface</span>
                  </div>
               </div>
               <div className="flex-1 glass rounded-2xl border-cyan-500/20 shadow-2xl overflow-hidden flex flex-col">
                  <div className="bg-black/40 border-b border-white/5 px-4 py-2 flex items-center justify-between">
                     <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                     </div>
                     <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">shell@termux: ~</span>
                  </div>
                  <div className="flex-1 bg-black/80 p-4 font-mono text-[11px] overflow-y-auto space-y-4 scroll-smooth custom-scrollbar">
                     {terminalHistory.length === 0 && (
                       <div className="text-white/20 italic animate-pulse">Neural Link Ready. Developed by NYNOAH.</div>
                     )}
                     {terminalHistory.map((entry, idx) => (
                       <div key={idx} className="animate-in fade-in slide-in-from-left duration-300">
                          <div className="flex items-start gap-2 text-cyan-400/80 mb-1">
                             <span className="text-white/40">#</span>
                             <span className="font-bold">{entry.cmd}</span>
                          </div>
                          <pre className={`whitespace-pre-wrap pl-4 border-l ${entry.err ? 'border-red-500/30 text-red-400' : 'border-green-500/20 text-green-500/90'} leading-relaxed font-mono`}>
                             {entry.out}
                          </pre>
                       </div>
                     ))}
                     <div ref={terminalBottomRef} />
                  </div>
                  <div className="p-3 border-t border-white/5 bg-black/40 flex gap-2">
                     <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 focus-within:border-cyan-500/30 transition-all">
                        <span className="text-cyan-400 mr-2 font-mono text-xs">$</span>
                        <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTermuxCommand(inputText).then(() => setInputText(''))} placeholder="INPUT_SHELL_CMD..." className="flex-1 bg-transparent py-3 text-white font-mono text-xs focus:outline-none" />
                     </div>
                     <button onClick={() => handleTermuxCommand(inputText).then(() => setInputText(''))} disabled={isProcessing} className="bg-cyan-500 text-black px-4 rounded-xl active:scale-95 disabled:opacity-50 transition-all shadow-lg">
                       {isProcessing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowUpIcon className="w-4 h-4 stroke-[3]" />}
                     </button>
                  </div>
               </div>
            </div>
          )
        )}

        {mode === AppMode.HACKING && (
          !termuxConnected ? <BridgeOfflineScreen /> : (
            <div className="flex-1 flex flex-col gap-4 py-6 animate-in fade-in duration-700 overflow-hidden relative">
              <canvas ref={hackingCanvasRef} className="absolute inset-0 z-0 opacity-20 pointer-events-none" />
              
              <div className="z-10 flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#00FF41] rounded-full animate-pulse shadow-[0_0_8px_#00FF41]" />
                    <span className="text-[#00FF41] font-mono text-[10px] font-bold tracking-[0.2em] uppercase">Hacking Command Core</span>
                  </div>
                  <div className="text-[#00FF41]/40 font-mono text-[8px] tracking-widest uppercase">Target: localhost // bridge: OK</div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {hackingToolkit.map((tool) => (
                    <button 
                      key={tool.label} 
                      onClick={() => handleTermuxCommand(`pkg install ${tool.pkg} -y`)}
                      className="glass border-[#00FF41]/20 p-3 rounded-xl flex flex-col items-center gap-2 group transition-all active:scale-95 hover:border-[#00FF41]/50"
                    >
                      <tool.icon className="w-5 h-5 text-[#00FF41]/60 group-hover:text-[#00FF41] transition-colors" />
                      <span className="text-[8px] font-mono text-[#00FF41]/80 uppercase font-bold text-center leading-none">{tool.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 glass border-[#00FF41]/20 rounded-2xl bg-black/90 p-4 font-mono text-[10px] overflow-hidden flex flex-col shadow-[0_0_30px_rgba(0,255,65,0.05)]">
                  <div className="flex items-center justify-between border-b border-[#00FF41]/20 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <CommandLineIcon className="w-3 h-3 text-[#00FF41]" />
                      <span className="text-[#00FF41] uppercase tracking-widest font-bold">Execution_Buffer</span>
                    </div>
                    <button onClick={() => setHackingLogs([])} className="text-[#00FF41]/20 hover:text-[#00FF41]"><TrashIcon className="w-3 h-3" /></button>
                  </div>
                  <div className="flex-1 flex flex-col-reverse overflow-y-auto no-scrollbar gap-1 custom-scrollbar">
                    {hackingLogs.length === 0 && (
                      <div className="text-[#00FF41]/20 italic flex flex-col items-center justify-center h-full gap-2">
                        <BugAntIcon className="w-12 h-12 opacity-10" />
                        <span>Waiting for exploit command...</span>
                      </div>
                    )}
                    {hackingLogs.map((log, i) => (
                      <div key={i} className={`border-l pl-2 py-0.5 animate-in slide-in-from-left ${log.startsWith('SHELL:') ? 'border-cyan-500/50 text-cyan-400' : 'border-[#00FF41]/30 text-[#00FF41]/80'}`}>
                        <span className="opacity-30 mr-2">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass border-[#00FF41]/40 bg-black/60 p-3 rounded-2xl flex gap-3 shadow-2xl">
                   <div className="text-[#00FF41] font-mono text-xs flex items-center pl-1">$</div>
                   <input 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleTermuxCommand(inputText).then(() => setInputText(''))}
                    placeholder="EXEC_SUDO_EXPLOIT..." 
                    className="flex-1 bg-transparent py-2 text-[#00FF41] font-mono text-xs focus:outline-none placeholder:text-[#00FF41]/10" 
                   />
                   <button 
                    onClick={() => handleTermuxCommand(inputText).then(() => setInputText(''))}
                    className={`p-2 rounded-lg transition-all ${inputText.trim() ? 'bg-[#00FF41] text-black shadow-[0_0_15px_#00FF41]' : 'text-[#00FF41]/30'}`}
                   >
                     <ArrowUpIcon className="w-4 h-4 stroke-[3]" />
                   </button>
                </div>
              </div>
            </div>
          )
        )}

        {(mode === AppMode.CHAT || mode === AppMode.MAPS) && (
          <div className="flex-1 flex flex-col gap-6 pb-32 overflow-y-auto pr-2 scroll-smooth">
            {messages.filter(m => m.type !== 'terminal').map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom`}>
                <div className={`max-w-[90%] rounded-2xl p-4 font-mono text-[13px] leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-cyan-500/10 border border-cyan-400/30 text-cyan-50' : 'bg-white/5 border border-white/10 text-white/80'}`}>
                  {m.imageUrl && <div className="mb-4 rounded-xl overflow-hidden border border-white/20 shadow-2xl"><img src={m.imageUrl} className="w-full object-cover" alt="Data Visualization" /></div>}
                  {m.type === 'location' && m.location && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-black/40 p-3 flex flex-col gap-3">
                       <div className="flex items-center gap-2">
                          <MapPinIcon className="w-5 h-5 text-cyan-400" />
                          <span className="text-[10px] font-bold tracking-widest uppercase">{m.location.title || 'BROADCAST_COORDINATES'}</span>
                       </div>
                       <a 
                        href={`https://www.google.com/maps?q=${m.location.lat},${m.location.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-cyan-500 text-black py-2 rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold active:scale-95 transition-all"
                       >
                         <ShareIcon className="w-3 h-3" />
                         OPEN_IN_MAPS
                       </a>
                    </div>
                  )}
                  <div className="break-words">
                    <span className={`font-bold mr-2 text-[10px] uppercase tracking-tighter ${m.role === 'user' ? 'text-cyan-400' : 'text-purple-400'}`}>{m.role === 'user' ? '[AUTH_USER]' : '[SYSTEM_EXE]'}</span>
                    {m.content || <div className="inline-flex gap-1 animate-pulse"><span className="w-1 h-1 bg-cyan-400"/><span className="w-1 h-1 bg-cyan-400"/><span className="w-1 h-1 bg-cyan-400"/></div>}
                  </div>
                </div>
              </div>
            ))}
            <div className="fixed bottom-28 left-8 right-8 flex gap-3 z-50 animate-in slide-in-from-bottom">
              <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="INPUT_COMMAND..." className="w-full bg-black/80 border border-white/10 rounded-xl px-5 py-4 text-white font-mono text-xs focus:outline-none focus:border-cyan-500/50 glass shadow-2xl" />
              <button onClick={handleSendMessage} className="bg-cyan-500 text-black px-5 rounded-xl active:scale-90 shadow-2xl"><ArrowUpIcon className="w-5 h-5 stroke-[3]" /></button>
            </div>
          </div>
        )}

        {mode === AppMode.IMAGE_GEN && (
          <div className="flex-1 flex flex-col justify-center animate-in fade-in duration-500">
             <div className="glass rounded-2xl p-8 border-cyan-500/20 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3"><SparklesIcon className="w-5 h-5 text-cyan-400" /><h3 className="font-mono font-bold text-white tracking-widest uppercase text-[11px]">Neural Synthesis</h3></div>
                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Synthesis parameters..." className="w-full bg-white/5 border border-white/10 rounded-xl p-5 min-h-[160px] text-white font-mono text-sm focus:outline-none focus:border-cyan-500/30 transition-all resize-none shadow-inner" />
                <button onClick={() => handleGenerateImage(inputText)} disabled={isProcessing || !inputText.trim()} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-mono font-bold py-5 rounded-xl uppercase tracking-[0.3em] text-[10px] active:scale-[0.97] disabled:opacity-50 shadow-xl">SYNTHESIZE</button>
             </div>
          </div>
        )}

        {mode === AppMode.IMAGE_ANALYSIS && (
          <div className="flex-1 flex flex-col py-6 space-y-6 animate-in zoom-in-95 duration-500 overflow-hidden">
            {capturedImages.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Square2StackIcon className="w-3 h-3 text-cyan-400" />
                    <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest font-bold">Session Gallery</span>
                  </div>
                  <button onClick={clearGallery} className="text-white/20 hover:text-red-400 transition-colors">
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                  {capturedImages.map((img, i) => (
                    <div key={i} onClick={() => handleReAnalyze(img)} className="flex-shrink-0 w-20 h-20 rounded-xl border border-white/10 overflow-hidden bg-black/40 active:scale-95 transition-all cursor-pointer relative group">
                      <img src={img} className="w-full h-full object-cover grayscale group-hover:grayscale-0" alt="Capture thumbnail" />
                      <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="relative flex-1 bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
               <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale opacity-80" />
               <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50" />
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50" />
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-cyan-500/50" />
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyan-500/50" />
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-cyan-500/20 animate-scan" />
               </div>
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                  <button onClick={handleCaptureImage} disabled={isProcessing} className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/40 flex items-center justify-center active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                    <div className="w-12 h-12 rounded-full bg-white shadow-xl" />
                  </button>
               </div>
               <div className="absolute top-6 left-6 flex items-center gap-2">
                 <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]" />
                 <span className="text-[10px] font-mono text-white/60 uppercase tracking-widest">LIVE // OPTIC</span>
               </div>
            </div>
          </div>
        )}

        {mode === AppMode.SETTINGS && (
          <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
             <div className="glass rounded-3xl p-8 border-cyan-500/20 max-w-md w-full space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <UserIcon className="w-20 h-20 text-cyan-500/10" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-mono font-bold text-cyan-400 tracking-[0.2em] uppercase text-xs">Core Architect</h3>
                  <h2 className="text-3xl font-bold text-white tracking-tighter">NYNOAH</h2>
                  <div className="h-0.5 w-12 bg-cyan-500 rounded-full" />
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-white/60 leading-relaxed font-mono">
                    Lead developer of sudO AI. NYNOAH specializes in executive-level artificial intelligence, terminal bridging, and mobile-first neural interfaces.
                  </p>
                  
                  <div className="flex flex-col gap-4 pt-4">
                    <a 
                      href="https://www.instagram.com/_nynoah_?igsh=MXd2b3lueHQ3b3R4bg==" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-white/10 rounded-2xl p-4 transition-all hover:border-pink-500/50 group active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg group-hover:shadow-pink-500/20">
                           <LinkIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <span className="block text-[10px] text-white/40 font-mono uppercase tracking-widest">Instagram</span>
                          <span className="text-white font-mono font-bold tracking-tighter">@_nynoah_</span>
                        </div>
                      </div>
                      <ArrowUpIcon className="w-4 h-4 text-white/20 rotate-45 group-hover:text-white transition-colors" />
                    </a>
                    
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="block text-[8px] text-white/30 font-mono uppercase tracking-widest">Environment</span>
                        <span className="text-green-400 font-mono font-bold tracking-tighter">STABLE_CORE</span>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_green]" />
                    </div>
                  </div>
                </div>
                <button onClick={() => setMode(AppMode.CONVERSATION)} className="w-full bg-white/5 hover:bg-white/10 text-white/60 font-mono py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all">Close Core Info</button>
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/10 safe-area-inset-bottom z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex justify-around items-center p-4 pb-8">
          {[
            { id: AppMode.CONVERSATION, icon: MicrophoneIcon },
            { id: AppMode.CHAT, icon: ChatBubbleBottomCenterIcon },
            { id: AppMode.TERMUX, icon: CommandLineIcon },
            { id: AppMode.HACKING, icon: BugAntIcon },
            { id: AppMode.IMAGE_GEN, icon: SparklesIcon },
            { id: AppMode.IMAGE_ANALYSIS, icon: CameraIcon },
            { id: AppMode.SETTINGS, icon: UserIcon },
          ].map(item => (
            <button key={item.id} onClick={() => { initAudio(); setMode(item.id); }} className={`p-2.5 rounded-xl transition-all relative ${mode === item.id ? (item.id === AppMode.HACKING ? 'text-[#00FF41] bg-[#00FF41]/10 shadow-[inset_0_0_10px_rgba(0,255,65,0.1)]' : 'text-cyan-400 bg-cyan-500/10') : 'text-white/20 hover:text-white/40'}`}>
              <item.icon className="w-5 h-5 stroke-[1.5]" />
              {mode === item.id && <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-[2px] rounded-full shadow-[0_0_8px_currentColor] ${item.id === AppMode.HACKING ? 'bg-[#00FF41]' : 'bg-cyan-400'}`} />}
            </button>
          ))}
        </div>
      </nav>
      <style>{`
        @keyframes scan { 0% { top: 10%; } 100% { top: 90%; } }
        .animate-scan { animation: scan 4s linear infinite alternate; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 242, 255, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 242, 255, 0.4); }
      `}</style>
    </div>
  );
};

export default App;
