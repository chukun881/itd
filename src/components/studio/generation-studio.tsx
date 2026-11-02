'use client';

import React, { useState, useEffect } from 'react';
import { ImageUploader } from '@/components/upload/image-uploader';
import { ModelViewer } from '@/components/viewer/model-viewer';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  RotateCw,
  Box,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface GenerationStudioProps {
  initialJobId?: string | null;
}

type StepStatus = 'waiting' | 'active' | 'completed' | 'error';

interface PipelineStep {
  id: string;
  label: string;
  desc: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'upload', label: '1. Secure Upload', desc: 'Direct upload to Cloudflare R2' },
  { id: 'queued', label: '2. Queue Dispatch', desc: 'Concurrency slot allocation' },
  { id: 'processing', label: '3. 3D AI Synthesis', desc: 'Outsourced neural mesh generation' },
  { id: 'compressing', label: '4. Optimization', desc: 'Meshopt decimation & Draco compression' },
  { id: 'completed', label: '5. Ready', desc: 'High-performance WebGL asset' },
];

export function GenerationStudio({ initialJobId }: GenerationStudioProps) {
  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId || null);
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [polyCount, setPolyCount] = useState<number | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Viewer Controls
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  // Connect to SSE event stream whenever activeJobId changes
  useEffect(() => {
    if (!activeJobId) return;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`/api/events/${activeJobId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setJobStatus(data.status);

          if (data.modelUrl) {
            setModelUrl(data.modelUrl);
          }
          if (data.processedFileSize) {
            setFileSize(data.processedFileSize);
          }
          if (data.polyCount) {
            setPolyCount(data.polyCount);
          }
          if (data.error) {
            setErrorMessage(data.error);
            toast.error(data.error);
          }

          if (data.status === 'completed') {
            toast.success('3D model ready for inspection!');
            eventSource?.close();
          } else if (data.status === 'failed' || data.status === 'refunded') {
            eventSource?.close();
          }
        } catch (err) {
          console.error('Failed to parse SSE payload:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
      };
    } catch (err) {
      console.error('SSE initialization error:', err);
    }

    return () => {
      eventSource?.close();
    };
  }, [activeJobId]);

  const getStepState = (stepIndex: number): StepStatus => {
    if (jobStatus === 'failed') return 'error';

    const statusMap: Record<string, number> = {
      pending: 0,
      uploading: 0,
      queued: 1,
      submitted: 2,
      processing: 2,
      compressing: 3,
      completed: 4,
    };

    const currentStep = statusMap[jobStatus] ?? -1;

    if (currentStep > stepIndex) return 'completed';
    if (currentStep === stepIndex) return 'active';
    return 'waiting';
  };

  return (
    <div className="space-y-8">
      {/* If no active generation or model is ready, show upload zone */}
      {(!activeJobId || jobStatus === 'completed' || jobStatus === 'failed') && (
        <ImageUploader
          onJobCreated={(newJobId) => {
            setActiveJobId(newJobId);
            setJobStatus('queued');
            setModelUrl(null);
            setErrorMessage(null);
          }}
        />
      )}

      {/* Real-time Progress Pipeline Tracker */}
      {activeJobId && jobStatus !== 'idle' && (
        <div className="rounded-2xl border bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold">Generation Pipeline</h3>
              <p className="text-xs text-neutral-500">Job ID: {activeJobId}</p>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/50">
              {jobStatus === 'completed' ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Complete
                </>
              ) : jobStatus === 'failed' ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" /> Failed & Refunded
                </>
              ) : (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> In Progress
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {PIPELINE_STEPS.map((step, idx) => {
              const state = getStepState(idx);
              return (
                <div
                  key={step.id}
                  className={`rounded-xl border p-3.5 transition-all ${
                    state === 'active'
                      ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-blue-500'
                      : state === 'completed'
                      ? 'border-green-500/30 bg-green-50/10 dark:bg-green-950/10'
                      : state === 'error'
                      ? 'border-red-500/30 bg-red-50/10'
                      : 'border-neutral-200 dark:border-neutral-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {state === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : state === 'active' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    )}
                    <span className="text-xs font-semibold">{step.label}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-tight">{step.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Interactive 3D Model Viewer Card (when ready) */}
          {jobStatus === 'completed' && modelUrl && (
            <div className="mt-8 border-t pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <h4 className="text-base font-bold">Interactive 3D Preview</h4>
                  {polyCount && (
                    <span className="text-xs rounded-md bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-neutral-600 dark:text-neutral-300 font-medium">
                      {polyCount.toLocaleString()} Polygons
                    </span>
                  )}
                  {fileSize && (
                    <span className="text-xs rounded-md bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-neutral-600 dark:text-neutral-300 font-medium">
                      {(fileSize / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWireframe(!wireframe)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      wireframe
                        ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950/40'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Wireframe
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoRotate(!autoRotate)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      autoRotate
                        ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950/40'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Auto Rotate
                  </button>

                  <a
                    href={modelUrl}
                    download={`model-${activeJobId}.glb`}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .GLB
                  </a>
                </div>
              </div>

              <ModelViewer
                modelUrl={modelUrl}
                wireframe={wireframe}
                autoRotate={autoRotate}
                className="w-full h-[520px]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
