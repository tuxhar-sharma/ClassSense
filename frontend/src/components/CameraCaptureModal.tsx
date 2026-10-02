import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, Upload, AlertCircle, Trash2 } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImages: (images: string[]) => void;
  targetCount?: number;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onConfirmImages,
  targetCount = 3,
}) => {
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    setIsCameraReady(false); setCameraError(null);
    if (isOpen && mode === 'camera') {
      void (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
          if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            if (!cancelled) { setIsCameraReady(true); }
          }
        } catch {
          if (!cancelled) { setCameraError('Camera access unavailable. You can upload photos directly.'); setMode('upload'); }
        }
      })();
    }
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [isOpen, mode]);

  const takeSnapshot = () => {
    if (!videoRef.current || capturedImages.length >= 4 || !videoRef.current.videoWidth) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImages((prev) => [...prev, dataUri].slice(0, 4));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).slice(0, 4 - capturedImages.length).forEach((file) => {
      if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        setCameraError('Choose JPEG or PNG images under 10 MB each.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCapturedImages((prev) => [...prev, event.target!.result as string].slice(0, 4));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    if (capturedImages.length < 3 || capturedImages.length > 4) return;
    onConfirmImages(capturedImages);
    setCapturedImages([]);
    onClose();
  };

  const handleClose = () => {
    setCapturedImages([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#162456]" />
              Multi-Image Classroom Capture
            </h3>
            <p className="text-xs text-slate-500">
              Capture 3–4 photos from slightly different classroom angles for robust multi-image aggregation
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Mode Switcher Tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-3">
            <button
              onClick={() => setMode('camera')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                mode === 'camera'
                  ? 'bg-[#162456] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Live Webcam Burst
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                mode === 'upload'
                  ? 'bg-[#162456] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Classroom Photos
            </button>
          </div>

          {mode === 'camera' ? (
            <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isCameraReady && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                  <span className="text-xs font-medium">Initializing camera viewfinder...</span>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center text-white bg-slate-900/90 gap-2">
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                  <p className="text-xs max-w-sm">{cameraError}</p>
                </div>
              )}

              {/* Viewfinder crosshairs */}
              <div className="absolute inset-8 border border-white/20 rounded-lg pointer-events-none flex items-center justify-center">
                <span className="text-[11px] text-white/50 bg-black/40 px-2 py-0.5 rounded">
                  Face classroom front
                </span>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition cursor-pointer relative">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                Click or drag & drop 3–4 classroom images
              </p>
              <p className="text-xs text-slate-500 mt-1">
                JPEG, PNG files supported
              </p>
            </div>
          )}

          {/* Action Row */}
          {mode === 'camera' && (
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-600">
                Shot <strong className="text-slate-900">{capturedImages.length}</strong> of{' '}
                <strong className="text-slate-900">{targetCount}</strong> recommended
              </div>
              <button
                onClick={takeSnapshot}
                disabled={!isCameraReady || capturedImages.length >= 4}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#991b1b] hover:bg-[#7f1d1d] disabled:opacity-50 transition shadow-sm"
              >
                <Camera className="w-4 h-4" />
                Capture Snapshot
              </button>
            </div>
          )}

          {/* Thumbnail Preview Strip */}
          {capturedImages.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Captured Frames ({capturedImages.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Raw images processed in-memory and discarded post-embedding
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {capturedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative shrink-0 w-24 h-[72px] rounded-lg overflow-hidden border-2 border-slate-300 group"
                  >
                    <img src={img} alt={`Frame ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/60 px-1 rounded">
                      #{idx + 1}
                    </span>
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition"
                      title="Remove image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={capturedImages.length < 3}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] disabled:opacity-50 transition shadow-sm"
          >
            <Check className="w-4 h-4" />
            Proceed to AI Recognition ({capturedImages.length} frames)
          </button>
        </div>
      </div>
    </div>
  );
};
