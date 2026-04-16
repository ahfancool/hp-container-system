import jsQR from "jsqr";
import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject
} from "react";
import { toast } from "sonner";

import { submitScanValidation, type ScanValidationResponse } from "../lib/scan";
import {
  submitPhoneTransaction,
  type TransactionResponse
} from "../lib/transaction";
import { addToBuffer } from "../lib/offline-buffer";
import { getFingerprint } from "../lib/fingerprint";
import { announceToScreenReader } from "../lib/a11y";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useForm } from "../hooks/useForm";

type MobileScannerShellProps = {
  accessToken: string;
  studentClassName: string;
  studentId: string;
  studentName: string;
  studentNis: string;
};

type ScanTone =
  | "idle"
  | "live"
  | "preview"
  | "processing"
  | "success-in"
  | "success-out"
  | "error";

function extractContainerId(rawValue: string): string | null {
  const match = /^container:\/\/([0-9a-f-]{36})(\?t=.*)?$/i.exec(rawValue.trim());
  return match?.[1] ?? null;
}

function extractQrToken(rawValue: string): string | null {
  try {
    const url = new URL(rawValue.trim());
    return url.searchParams.get("t");
  } catch {
    return null;
  }
}

function stopStream(streamRef: MutableRefObject<MediaStream | null>) {
  const stream = streamRef.current;

  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }

  streamRef.current = null;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function triggerVibration(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function getActionLabel(action: "IN" | "OUT"): string {
  return action === "IN" ? "Simpan HP ke container" : "Ambil HP dari container";
}

export function MobileScannerShell({
  accessToken,
  studentClassName,
  studentId,
  studentName,
  studentNis
}: MobileScannerShellProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isBusyRef = useRef(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [detectedPayload, setDetectedPayload] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ScanValidationResponse | null>(null);
  const [transactionResult, setTransactionResult] =
    useState<TransactionResponse | null>(null);
  const [scanTone, setScanTone] = useState<ScanTone>("idle");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const {
    values: manualValues,
    errors: manualErrors,
    touched: manualTouched,
    isValid: isManualValid,
    handleChange: handleManualChange,
    handleBlur: handleManualBlur,
    handleSubmit: handleManualSubmit,
    setValues: setManualValues,
  } = useForm(
    { manualValue: "" },
    {
      manualValue: {
        required: true,
        custom: (val) => {
          if (!val.startsWith("container://")) return "Harus diawali container://";
          if (!extractContainerId(val)) return "Format ID tidak valid";
          return null;
        }
      }
    },
    async (formValues) => {
      const nextContainerId = extractContainerId(formValues.manualValue.trim());
      if (nextContainerId) {
        stopCamera();
        await runPreview(nextContainerId, formValues.manualValue.trim());
      }
    }
  );

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      stopStream(streamRef);
    };
  }, []);

  const stopCamera = () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    stopStream(streamRef);
    setIsCameraActive(false);
  };

  const clearFlowState = () => {
    setCameraError(null);
    setPreviewError(null);
    setTransactionError(null);
    setPreviewResult(null);
    setTransactionResult(null);
    setDetectedPayload(null);
    setIsConfirmModalOpen(false);
    setIsSuccessModalOpen(false);
  };

  const runPreview = async (
    nextContainerId: string,
    rawPayload: string
  ) => {
    if (isBusyRef.current) return;

    isBusyRef.current = true;
    setIsPreviewing(true);
    clearFlowState();
    setDetectedPayload(rawPayload);
    setScanTone("processing");
    announceToScreenReader("Memvalidasi scan, mohon tunggu...");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setScanTone("preview");
      setPreviewResult({
        authenticatedStudent: { id: studentId, name: studentName, nis: studentNis },
        message: "Offline mode ready.",
        transactionRecorded: false,
        validation: {
          actionPreview: "IN",
          container: {
            createdAt: new Date().toISOString(),
            id: nextContainerId,
            isActive: true,
            location: "Offline Location",
            name: "Offline Container",
            qrCode: rawPayload,
            updatedAt: new Date().toISOString()
          },
          lastTransaction: null,
          penaltyStatus: undefined,
          rules: {
            allowedAt: "Now",
            currentLocalTime: "Now",
            endsAt: "Later",
            isAllowed: true,
            scheduleType: "REGULAR_IN",
            timeZone: "WIB"
          },
          transactionTypePreview: "REGULAR",
          validatedTimestamp: new Date().toISOString(),
          activeApproval: null
        }
      });
      setIsConfirmModalOpen(true);
      isBusyRef.current = false;
      setIsPreviewing(false);
      return;
    }

    try {
      const fingerprint = await getFingerprint();
      const qrToken = extractQrToken(rawPayload) || undefined;
      const result = await submitScanValidation(accessToken, {
        containerId: nextContainerId,
        studentId,
        timestamp: new Date().toISOString(),
        fingerprint,
        qrToken
      });

      setPreviewResult(result);
      setScanTone(result.validation.rules.isAllowed ? "preview" : "error");
      setIsConfirmModalOpen(true);
      triggerVibration(result.validation.rules.isAllowed ? 30 : [40, 30, 40]);
      
      if (result.validation.rules.isAllowed) {
        announceToScreenReader(`Scan berhasil. Siap untuk ${getActionLabel(result.validation.actionPreview)}`);
      } else {
        announceToScreenReader(`Scan ditolak. ${result.validation.penaltyStatus?.message || "Tidak sesuai jadwal"}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preview scan gagal.";
      setPreviewError(message);
      setScanTone("error");
      triggerVibration([50, 40, 50]);
      announceToScreenReader(`Scan gagal. ${message}`);
    } finally {
      isBusyRef.current = false;
      setIsPreviewing(false);
    }
  };

  const processFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isBusyRef.current) return;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(video, 0, 0, width, height);
          const imageData = context.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });

          if (code?.data) {
            const nextContainerId = extractContainerId(code.data);
            if (nextContainerId) {
              setManualValues({ manualValue: code.data });
              stopCamera();
              void runPreview(nextContainerId, code.data);
              return;
            }
          }
        }
      }
    }
    frameRef.current = requestAnimationFrame(processFrame);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera tidak didukung.");
      return;
    }

    stopCamera();
    setIsStartingCamera(true);
    clearFlowState();
    setScanTone("processing");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Video element missing.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsCameraActive(true);
      setScanTone("live");
      frameRef.current = requestAnimationFrame(processFrame);
    } catch (error) {
      stopCamera();
      setCameraError(error instanceof Error ? error.message : "Gagal buka kamera.");
      setScanTone("error");
    } finally {
      setIsStartingCamera(false);
    }
  };

  useEffect(() => {
    void startCamera();
  }, []);

  const handleConfirmTransaction = async () => {
    if (!previewResult || !previewResult.validation.rules.isAllowed || isBusyRef.current) return;

    isBusyRef.current = true;
    setIsSubmittingTransaction(true);
    setScanTone("processing");
    const timestamp = new Date().toISOString();
    const requestId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const qrToken = detectedPayload ? (extractQrToken(detectedPayload) || undefined) : undefined;

    try {
      const fingerprint = await getFingerprint();
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await addToBuffer({
          container_id: previewResult.validation.container.id,
          fingerprint,
          qr_token: qrToken,
          student_id: studentId,
          timestamp,
          type: "REGULAR",
          request_id: requestId,
        });
        setIsConfirmModalOpen(false);
        setIsSuccessModalOpen(true);
        setScanTone("success-in");
        announceToScreenReader("Transaksi offline disimpan secara lokal.");
        return;
      }

      const result = await submitPhoneTransaction(accessToken, {
        containerId: previewResult.validation.container.id,
        studentId,
        timestamp,
        type: "REGULAR",
        requestId,
        fingerprint,
        qrToken
      });

      setTransactionResult(result);
      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);
      setScanTone(result.transaction.action === "IN" ? "success-in" : "success-out");
      triggerVibration(result.transaction.action === "IN" ? 90 : [60, 40, 60]);
      announceToScreenReader(`Transaksi berhasil. HP telah ${result.transaction.action === "IN" ? "tersimpan" : "diambil"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaksi gagal.";
      setTransactionError(message);
      setScanTone("error");
      announceToScreenReader(`Transaksi gagal. ${message}`);
    } finally {
      isBusyRef.current = false;
      setIsSubmittingTransaction(false);
    }
  };

  const lastStatus = previewResult?.validation.lastTransaction?.action || "OUT";
  const currentAction = previewResult?.validation.actionPreview || (lastStatus === "IN" ? "OUT" : "IN");

  return (
    <section className="flex flex-col gap-6 w-full max-w-lg mx-auto">
      {/* 1. Top: Current Phone Status */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="panel-tag">Status HP Saat Ini</span>
          <Badge variant={lastStatus === "IN" ? "primary" : "outline"}>
            {lastStatus === "IN" ? "Terdata di Container" : "Ada pada Siswa"}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-bold">{studentName}</h3>
          <p className="text-sm text-muted">NIS {studentNis} | {studentClassName}</p>
        </div>
      </Card>

      {/* 2. Center: Camera Scanner View */}
      <div className="relative aspect-[4/5] rounded-[32px] overflow-hidden bg-black shadow-2xl">
        <video
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          ref={videoRef}
          aria-label="Kamera scanner QR"
        />
        <canvas className="hidden" ref={canvasRef} aria-hidden="true" />
        
        {/* QR Alignment Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
          <div className="w-64 h-64 border-2 border-white/80 rounded-[40px] shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)] flex items-center justify-center">
             <div className="w-16 h-1 w-white/30 rounded-full absolute top-8" />
             <div className="w-64 h-64 border-2 border-accent rounded-[40px] animate-pulse" />
          </div>
          <p className="absolute bottom-12 text-white/90 text-sm font-semibold tracking-wide uppercase px-4 py-2 bg-black/30 backdrop-blur-md rounded-full">
            Sejajarkan QR dalam kotak
          </p>
        </div>

        {isStartingCamera && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white" aria-live="polite">
            <p className="font-bold">Membuka Kamera...</p>
          </div>
        )}

        {isPreviewing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white backdrop-blur-sm" aria-live="polite">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="font-bold">Memvalidasi Scan...</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom: Manual Input & Actions */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="panel-tag">Input Manual</span>
          <form 
            className="flex flex-col gap-2" 
            onSubmit={(e) => {
              e.preventDefault();
              handleManualSubmit();
            }}
          >
            <div className="flex gap-2">
              <input
                id="input-manualvalue"
                className={`text-input flex-1 ${manualTouched.manualValue && manualErrors.manualValue ? "border-danger" : ""}`}
                onChange={(e) => handleManualChange("manualValue", e.target.value)}
                onBlur={() => handleManualBlur("manualValue")}
                placeholder=" container://..."
                type="text"
                value={manualValues.manualValue}
                aria-label="Manual QR payload"
                aria-invalid={manualTouched.manualValue && !!manualErrors.manualValue}
                aria-describedby={manualTouched.manualValue && manualErrors.manualValue ? "manual-qr-error" : undefined}
              />
              <Button 
                variant="secondary" 
                size="sm" 
                type="submit"
                disabled={manualTouched.manualValue && !!manualErrors.manualValue}
                title={manualErrors.manualValue}
                aria-label="Cek QR manual"
              >
                Cek
              </Button>
            </div>
            {manualTouched.manualValue && manualErrors.manualValue && (
              <span id="manual-qr-error" className="text-xs text-danger" role="alert">{manualErrors.manualValue}</span>
            )}
          </form>
        </div>
        
        {!isCameraActive && !isPreviewing && !isConfirmModalOpen && !isSuccessModalOpen && (
          <Button onClick={startCamera} className="w-full" size="lg" aria-label="Mulai scan kamera baru">
            Scan QR Baru
          </Button>
        )}
        
        {isCameraActive && (
          <Button variant="secondary" onClick={stopCamera} className="w-full" aria-label="Matikan kamera">
            Matikan Kamera
          </Button>
        )}
      </Card>

      {/* Confirmation Bottom Sheet */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Konfirmasi Transaksi"
        type="bottom-sheet"
        footer={
          <>
            <Button 
              size="lg" 
              onClick={handleConfirmTransaction}
              disabled={!previewResult?.validation.rules.isAllowed || isSubmittingTransaction}
            >
              {isSubmittingTransaction ? "Memproses..." : "Konfirmasi & Lanjutkan"}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => {
                setIsConfirmModalOpen(false);
                void startCamera();
              }}
            >
              Batal
            </Button>
          </>
        }
      >
        {previewResult && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-strong">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent" aria-hidden="true">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={currentAction === "IN" ? "M19 14l-7 7m0 0l-7-7m7 7V3" : "M5 10l7-7m0 0l7 7m-7-7v18"} />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted uppercase">Aksi</span>
                <span className="text-lg font-bold">{getActionLabel(previewResult.validation.actionPreview)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-muted uppercase">Container</span>
                <span className="font-semibold">{previewResult.validation.container.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-muted uppercase">Lokasi</span>
                <span className="font-semibold">{previewResult.validation.container.location}</span>
              </div>
            </div>

            {!previewResult.validation.rules.isAllowed && (
              <div className="p-4 rounded-2xl bg-danger-bg text-danger flex flex-col gap-1" role="alert">
                 <p className="font-bold">Scan Tidak Diizinkan</p>
                 <p className="text-sm opacity-90">
                   {previewResult.validation.penaltyStatus?.message || 
                    "Tidak sesuai jadwal operasional. Silakan hubungi guru jika darurat."}
                 </p>
              </div>
            )}
            
            {transactionError && (
              <div className="p-4 rounded-2xl bg-danger-bg text-danger text-sm font-semibold" role="alert">
                {transactionError}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Success Animation Modal */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={() => {
          setIsSuccessModalOpen(false);
          void startCamera();
        }}
        title="Transaksi Berhasil"
      >
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="w-24 h-24 rounded-full bg-success-bg flex items-center justify-center text-success animate-bounce" aria-hidden="true">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-bold text-ink">Selesai!</h3>
            <p className="text-muted mt-1">
              {transactionResult?.message || "Scan offline telah disimpan secara lokal."}
            </p>
          </div>
          
          <Card className="w-full bg-surface-strong/50 border-none">
             <div className="grid grid-cols-2 gap-y-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted uppercase">Status</span>
                  <span className="font-bold text-success">{transactionResult?.transaction.action === "IN" ? "TERSIMPAN" : "DIAMBIL"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted uppercase">Waktu</span>
                  <span className="font-bold">{transactionResult ? formatDateTime(transactionResult.transaction.timestamp) : formatDateTime(new Date().toISOString())}</span>
                </div>
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold text-muted uppercase">Container</span>
                  <span className="font-bold">{transactionResult?.validation.container.name || previewResult?.validation.container.name}</span>
                </div>
             </div>
          </Card>

          <Button onClick={() => {
            setIsSuccessModalOpen(false);
            void startCamera();
          }} className="w-full" size="lg">Scan Lainnya</Button>
        </div>
      </Modal>

      {cameraError && (
        <Card variant="danger" className="text-center" role="alert">
          <p className="font-bold mb-2">Masalah Kamera</p>
          <p className="text-sm opacity-90 mb-4">{cameraError}</p>
          <Button variant="secondary" onClick={() => void startCamera()}>Coba Lagi</Button>
        </Card>
      )}

      {previewError && (
        <Card variant="danger" className="text-center" role="alert">
          <p className="font-bold mb-2">Gagal Validasi</p>
          <p className="text-sm opacity-90 mb-4">{previewError}</p>
          <Button variant="secondary" onClick={() => void startCamera()}>Scan Ulang</Button>
        </Card>
      )}
    </section>
  );
}
