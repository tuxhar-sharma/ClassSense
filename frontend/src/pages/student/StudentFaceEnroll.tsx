import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { ScanFace, Camera, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Upload } from 'lucide-react';

export const StudentFaceEnroll: React.FC = () => {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.getStudentProfile(user.id);
      setProfile(res);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unable to load your profile.' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);



  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    
    if (isCameraActive) {
      void (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
          if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            if (!cancelled) {  }
          }
        } catch {
          if (!cancelled) { setMessage({ type: 'error', text: 'Webcam unavailable. Please use file upload.' }); setIsCameraActive(false); }
        }
      })();
    }
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [isCameraActive]);

  const capturePhoto = () => {
    if (!videoRef.current?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const v = videoRef.current;
      const minDim = Math.min(v.videoWidth, v.videoHeight);
      const sx = (v.videoWidth - minDim) / 2;
      const sy = (v.videoHeight - minDim) / 2;
      ctx.drawImage(v, sx, sy, minDim, minDim, 0, 0, 480, 480);
      setNewPhotoBase64(canvas.toDataURL('image/jpeg', 0.9));
      setIsCameraActive(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setNewPhotoBase64(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEnroll = async () => {
    if (!newPhotoBase64) return;
    setUpdating(true);
    setMessage(null);
    try {
      const res = await api.enrollFace(newPhotoBase64);
      setMessage({ type: 'success', text: res.message || "Face enrolled successfully." });
      setNewPhotoBase64(null);
      fetchProfile();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Enrolment failed." });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ScanFace className="w-5 h-5 text-[#162456]" />
          Facial Biometric Enrolment
        </h1>
        <p className="text-xs text-slate-500">
          Manage your 512-dimensional ArcFace template for classroom multi-image recognition
        </p>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading your profile...</p>}
      {message && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Enrolment Status</h3>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
              profile?.face_enrolled
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {profile?.face_enrolled ? 'Enrolled & Verified' : 'Action Required'}
            </span>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="Profile Face" className="w-full h-full object-cover" />
              ) : (
                <ScanFace className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-bold text-slate-900">{profile?.full_name}</p>
              <p className="text-slate-500 font-mono">{profile?.enrollment_no}</p>
              <p className="text-[11px] text-slate-500">{profile?.branch} • {profile?.section}</p>
              <p className="text-[10px] text-emerald-600 font-semibold pt-1">
                Vector Dimension: 512 (ArcFace L2 Normalized)
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Security & Privacy Guarantee:</p>
            <p>Your biometric embedding is stored with AES-256 encryption at rest. Raw classroom photos are discarded immediately after processing.</p>
          </div>
        </div>

        {/* Update Enrolment Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Update Face Template</h3>
          <p className="text-xs text-slate-500">
            If your appearance has changed or camera lighting caused recognition flags, update your frontal selfie.
          </p>

          <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative">
            {isCameraActive ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="absolute bottom-3 px-4 py-1.5 rounded-full text-xs font-bold bg-[#991b1b] text-white shadow-lg"
                >
                  Snap Photo
                </button>
              </>
            ) : newPhotoBase64 ? (
              <div className="relative w-full h-full">
                <img src={newPhotoBase64} alt="New Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => setNewPhotoBase64(null)}
                  className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-[10px]"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="text-center text-slate-400 p-4">
                <Camera className="w-10 h-10 mx-auto mb-1 opacity-50" />
                <p className="text-xs">Camera viewfinder closed</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsCameraActive(!isCameraActive)}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              {isCameraActive ? "Close Camera" : "Open Camera"}
            </button>
            <label className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Upload Image
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {newPhotoBase64 && (
            <button
              type="button"
              onClick={handleEnroll}
              disabled={updating}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-1.5"
            >
              {updating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
              {updating ? "Processing Embedding..." : "Update ArcFace Embedding"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
