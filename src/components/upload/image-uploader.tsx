'use client';

import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useJobStore } from '@/store';
import { GENERATION_COSTS } from '@/lib/constants';

interface ImageUploaderProps {
  onJobCreated?: (jobId: string) => void;
}

export function ImageUploader({ onJobCreated }: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tier, setTier] = useState<'standard' | 'premium'>('standard');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setActiveJob, decrementCredits } = useJobStore();

  // Helper to resize image client-side to max 2048x2048 before upload
  async function resizeImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const maxDim = 2048;
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          file.type,
          0.92
        );
      };
      img.onerror = reject;
    });
  }

  const handleFile = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a valid JPG, PNG, or WebP image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartGeneration = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadProgress('Optimizing image...');

      // 1. Client-side resize
      const optimizedBlob = await resizeImage(selectedFile);

      setUploadProgress('Requesting secure direct upload...');

      // 2. Request presigned PUT URL from backend
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile.name,
          fileSize: optimizedBlob.size,
          contentType: selectedFile.type,
          tier,
        }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Failed to initialize upload');
      }

      const { jobId, uploadUrl } = uploadData;

      // 3. Direct upload to Cloudflare R2 (bypasses serverless functions)
      setUploadProgress('Uploading directly to cloud storage...');
      const r2Res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type,
        },
        body: optimizedBlob,
      });

      if (!r2Res.ok) {
        throw new Error('Failed to upload image to storage');
      }

      // 4. Trigger generation job
      setUploadProgress('Queueing 3D generation...');
      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      const generateData = await generateRes.json();
      if (!generateRes.ok) {
        throw new Error(generateData.error || 'Failed to start generation');
      }

      decrementCredits(GENERATION_COSTS[tier]);
      toast.success('3D model generation initiated!');

      if (onJobCreated) {
        onJobCreated(jobId);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border bg-white dark:bg-neutral-900 p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Generate 3D Model</h2>
        <p className="text-sm text-neutral-500">
          Upload any 2D image. Best results come from isolated objects on neutral backgrounds.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          dragActive
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-neutral-300 dark:border-neutral-800 hover:border-neutral-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />

        {previewUrl ? (
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Upload preview"
              className="max-h-64 rounded-lg object-contain shadow-sm mb-4"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:underline"
            >
              Choose a different image
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <div className="rounded-full bg-blue-50 dark:bg-blue-950/50 p-4 text-blue-600 mb-3">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">Drag & drop your image here, or click to browse</p>
            <p className="text-xs text-neutral-400 mt-1">Supports JPG, PNG, WebP up to 10MB</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-xs font-semibold hover:bg-neutral-200 transition-colors"
            >
              Select File
            </button>
          </div>
        )}
      </div>

      {/* Quality Tier Selector */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setTier('standard')}
          className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
            tier === 'standard'
              ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-blue-600'
              : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Standard Tier</span>
            <span className="text-xs font-bold text-blue-600">{GENERATION_COSTS.standard} Credit</span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">Fast web preview (~60s), lightweight mesh</p>
        </button>

        <button
          type="button"
          onClick={() => setTier('premium')}
          className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
            tier === 'premium'
              ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-blue-600'
              : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Premium Tier</span>
            <span className="text-xs font-bold text-purple-600">{GENERATION_COSTS.premium} Credits</span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">High-poly topology & full PBR texture maps</p>
        </button>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        disabled={!selectedFile || isUploading}
        onClick={handleStartGeneration}
        className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{uploadProgress || 'Processing...'}</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>Generate 3D Model ({GENERATION_COSTS[tier]} credit)</span>
          </>
        )}
      </button>
    </div>
  );
}
