import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { Camera, ArrowLeft, Check, AlertCircle, ScanFace, Upload, ShieldCheck } from 'lucide-react';

interface StudentRegisterProps {
  onNavigate: (page: string) => void;
}

export const StudentRegister: React.FC<StudentRegisterProps> = ({ onNavigate }) => {
  const [fullName, setFullName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branch, setBranch] = useState('Information Technology');
  const [semester, setSemester] = useState('6th');
  const [section, setSection] = useState('IT-1');
  const [phone] = useState('');
  
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { login } = useAuthStore();

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
          if (!cancelled) { setError('Webcam unavailable. Please use file upload.'); setIsCameraActive(false); }
        }
      })();
    }
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [isCameraActive]);

  const captureSelfie = () => {
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
      const b64 = canvas.toDataURL('image/jpeg', 0.9);
      setPhotoBase64(b64);
      setIsCameraActive(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoBase64(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBase64) {
      setError("Please capture or upload a frontal selfie for facial biometric enrolment.");
      return;
    }
    if (!consentChecked) {
      setError("Biometric processing consent is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.registerStudent({
        email,
        password,
        full_name: fullName,
        enrollment_no: enrollmentNo,
        semester,
        branch,
        section,
        phone,
        photo_base64: photoBase64
      });

      login(res.access_token, {
        id: res.user_id,
        email,
        role: 'student',
        full_name: fullName
      });
      onNavigate('dashboard');
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check form fields.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#162456] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('login')}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold">Student Registration & Facial Enrolment</h2>
              <p className="text-xs text-blue-200">BPIT Smart Attendance Portal</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <ScanFace className="w-6 h-6 text-amber-300" />
          </div>
        </div>

        {error && (
          <div className="m-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section 1: Academic Profile */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              1. Academic Credentials
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rohan Sharma"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Enrollment Number</label>
                <input
                  type="text"
                  required
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  placeholder="e.g. 04220803121"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@bpitindia.edu.in"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                >
                  <option value="Information Technology">Information Technology</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Electrical & Electronics">Electrical & Electronics</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                  >
                    {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(semester => <option key={semester} value={semester}>{semester} Semester</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Facial Biometric Enrolment */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Facial Biometric Enrolment (ArcFace 512-d)
              </h3>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Encrypted at Rest
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Camera or Preview Viewport */}
              <div className="bg-slate-900 rounded-xl overflow-hidden aspect-square flex items-center justify-center relative border border-slate-300">
                {isCameraActive ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={captureSelfie}
                      className="absolute bottom-3 px-4 py-1.5 rounded-full text-xs font-bold bg-[#991b1b] text-white shadow-lg"
                    >
                      Snap Selfie
                    </button>
                  </>
                ) : photoBase64 ? (
                  <div className="relative w-full h-full">
                    <img src={photoBase64} alt="Enrolled Face" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoBase64(null)}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-[10px]"
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-4 text-slate-400">
                    <ScanFace className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No face enrolled yet</p>
                  </div>
                )}
              </div>

              {/* Enrolment Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                >
                  <Camera className="w-4 h-4 text-blue-600" />
                  {isCameraActive ? "Stop Camera" : "Open Camera for Selfie"}
                </button>

                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    Upload Profile Photo
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 text-[11px] text-blue-800 space-y-1">
                  <p className="font-semibold">Photo Guidelines:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-[10px]">
                    <li>Ensure good frontal lighting</li>
                    <li>Avoid sunglasses or heavy shadows</li>
                    <li>An encrypted face template and profile thumbnail are stored for attendance review</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-2 pt-2">
            <input
              type="checkbox"
              id="consent"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-1 rounded border-slate-300 text-[#162456] focus:ring-[#162456]"
            />
            <label htmlFor="consent" className="text-xs text-slate-600">
              I consent to the capture and extraction of 512-dimensional facial biometric embeddings strictly for academic attendance marking in BPIT courses as per institute policy.
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] disabled:opacity-50 transition shadow-md shadow-blue-950/10 flex items-center justify-center gap-2"
          >
            {loading ? "Generating Biometric Embedding..." : "Complete Registration & Face Enrolment"}
            <Check className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
