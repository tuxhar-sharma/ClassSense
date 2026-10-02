import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../../api/client';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Download} from 'lucide-react';

export const RosterUpload: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.getCourses();
      setCourses(res);
      if (res.length > 0) setSelectedCourseId(res[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load courses.');
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !file) {
      setError("Please choose a course and attach a CSV roster file.");
      return;
    }

    setUploading(true);
    setError(null);
    setResultMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await api.uploadRoster(selectedCourseId, file);
      setResultMessage(data.message || "Roster processed successfully.");
      setFile(null);
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent = "data:text/csv;charset=utf-8,enrollment_no\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "classsense_roster_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {courses.length === 0 && <p className="text-sm text-slate-600">Create a course in Course Management before uploading a roster. Students must register first.</p>}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          Bulk Student Roster CSV Upload
        </h1>
        <p className="text-xs text-slate-500">
          Enrolls entire classroom batches into courses in a single operation
        </p>
      </div>

      {resultMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{resultMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Target Course
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#162456] outline-none bg-white"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code}: {c.course_name} ({c.enrolled_count} currently enrolled)
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Upload CSV Roster
              </label>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="text-[11px] font-semibold text-blue-700 hover:underline flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download CSV Template
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition cursor-pointer relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                {file ? file.name : "Click or drag & drop student roster CSV file"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Required columns: enrollment_no, full_name, email
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full py-3 rounded-xl text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] disabled:opacity-50 transition shadow-md shadow-blue-950/10 flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Processing Roster Import..." : "Import Students to Course Roster"}
          </button>
        </form>
      </div>
    </div>
  );
};
