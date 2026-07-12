import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, Loader2, FileSpreadsheet, X } from 'lucide-react';
import API_BASE_URL from '../utils/api';

interface UploadProps {
  onUploadSuccess: (filename: string) => void;
}

export default function Upload({ onUploadSuccess }: UploadProps) {
  const [file,           setFile]           = useState<File | null>(null);
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive,   setIsDragActive]   = useState(false);
  const [uploadDone,     setUploadDone]     = useState(false);

  const handleUpload = useCallback(async (selectedFile: File) => {
    setIsUploading(true);
    setUploadProgress(10);
    setUploadDone(false);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setUploadProgress(50);
      const response = await axios.post(`${API_BASE_URL}/api/upload/`, formData, {
        headers:          { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: pe => {
          if (pe.total) setUploadProgress(Math.round((pe.loaded / pe.total) * 80) + 10);
        },
      });
      setUploadProgress(100);
      setUploadDone(true);
      setTimeout(() => {
        onUploadSuccess(response.data.filename);
        setIsUploading(false);
        setFile(null);
        setUploadProgress(0);
        setUploadDone(false);
      }, 1000);
    } catch (err) {
      console.error('Upload failed', err);
      setIsUploading(false);
      setUploadProgress(0);
      alert('Upload failed. Please try again.');
    }
  }, [onUploadSuccess]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) { setFile(e.target.files[0]); handleUpload(e.target.files[0]); }
  };
  const onDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) { const f = e.dataTransfer.files[0]; setFile(f); handleUpload(f); }
  };
  const clear = (e: React.MouseEvent) => {
    e.stopPropagation(); setFile(null); setUploadProgress(0); setIsUploading(false); setUploadDone(false);
  };

  return (
    <div
      id="file-upload-input"
      onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
      className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out
        ${isDragActive
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[1.01]'
          : 'border-slate-200 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-500/50 bg-white dark:bg-slate-800/20 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5'
        }
      `}
    >
      {/* Drag glow */}
      {isDragActive && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-purple-400/20 rounded-full blur-3xl" />
        </div>
      )}

      <input type="file" accept=".csv" onChange={onFileChange} className="hidden" id="file-upload" />

      <label htmlFor="file-upload" className="cursor-pointer block p-8">
        {isUploading ? (
          <div className="flex flex-col items-center gap-4 animate-fade-in py-4">
            {uploadDone ? (
              <>
                <CheckCircle size={44} className="text-emerald-500 animate-bounce-in" />
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Upload Complete!</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Redirecting to chat...</p>
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                    <Loader2 size={28} className="text-indigo-500 dark:text-indigo-400 animate-spin" />
                  </div>
                  <div className="absolute -inset-1 rounded-2xl border border-indigo-400/30 animate-ping" />
                </div>
                <div className="w-full max-w-xs">
                  <div className="flex justify-between items-center mb-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate max-w-[160px]">{file?.name ?? 'Uploading…'}</span>
                    <span className="font-bold text-indigo-500 dark:text-indigo-400">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="upload-progress h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
                {file && (
                  <button onClick={clear} className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer">
                    <X size={12} /> Cancel
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            {/* Animated icon */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              isDragActive
                ? 'bg-indigo-100 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 scale-110'
                : 'bg-slate-100 dark:bg-slate-700/40 text-slate-400 dark:text-slate-400'
            }`}>
              <UploadCloud size={30} />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {isDragActive ? 'Release to upload' : 'Drop your CSV here'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                or{' '}
                <span className="text-indigo-500 dark:text-indigo-400 underline underline-offset-2 font-semibold">
                  click to browse
                </span>
                {' '}from your computer
              </p>
            </div>

            {/* Format badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/30">
              <FileSpreadsheet size={12} className="text-emerald-500" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">.csv files only</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-600">· Max 50 MB</span>
            </div>
          </div>
        )}
      </label>
    </div>
  );
}
