import jsQR from "jsqr";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
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
  return action === "IN" ? "Masuk ke container" : "Keluar dari container";
}

function getConfirmLabel(action: "IN" | "OUT"): string {
  return action === "IN" ? "Konfirmasi simpan HP" : "Konfirmasi ambil HP";
}

function getPenaltyLabel(type: "SEIZURE_24H" | "PARENT_PICKUP"): string {
  return type === "SEIZURE_24H" ? "Sita 1x24 jam" : "Ambil oleh orang tua";
}

function getPreviewTitle(preview: ScanValidationResponse): string {
  if (preview.validation.penaltyStatus?.isPenalized) {
    return "HP sedang dalam status penalti";
  }

  if (preview.validation.activeApproval) {
    return "Approval guru terdeteksi";
  }

  if (!preview.validation.rules.isAllowed) {
    return preview.validation.actionPreview === "IN"
      ? "Belum masuk jam simpan"
      : "Belum masuk jam ambil";
  }

  return preview.validation.actionPreview === "IN"
    ? "Preview simpan HP siap"
    : "Preview ambil HP siap";
}

function getPreviewMessage(preview: ScanValidationResponse): string {
  if (preview.validation.penaltyStatus?.isPenalized) {
    return preview.validation.penaltyStatus.message;
  }

  if (preview.validation.activeApproval) {
    return `Scan ini akan mencatat ${getActionLabel(
      preview.validation.actionPreview
    ).toLowerCase()} dengan izin ${preview.validation.activeApproval.type.toLowerCase()} dari ${preview.validation.activeApproval.approvedBy.name}.`;
  }

  if (!preview.validation.rules.isAllowed) {
    if (preview.validation.rules.scheduleType === "REGULAR_IN") {
      return `Penyimpanan reguler hanya boleh antara ${preview.validation.rules.allowedAt} sampai ${preview.validation.rules.endsAt} ${preview.validation.rules.timeZone}.`;
    }

    return `Pengambilan reguler baru boleh mulai ${preview.validation.rules.allowedAt} ${preview.validation.rules.timeZone}. Jika mendesak, minta approval guru terlebih dahulu.`;
  }

  return preview.validation.actionPreview === "IN"
    ? "QR valid. Periksa ringkasan lalu konfirmasi untuk menyimpan HP ke container."
    : "QR valid. Periksa ringkasan lalu konfirmasi untuk mengambil HP dari container.";
}

function getPreviewTone(preview: ScanValidationResponse): ScanTone {
  if (preview.validation.penaltyStatus?.isPenalized) {
    return "error";
  }

  if (!preview.validation.rules.isAllowed) {
    return "error";
  }

  return "preview";
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
  const [manualValue, setManualValue] = useState("");
  const [detectedPayload, setDetectedPayload] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ScanValidationResponse | null>(null);
  const [transactionResult, setTransactionResult] =
    useState<TransactionResponse | null>(null);
  const [statusTitle, setStatusTitle] = useState("Siap untuk scan HP");
  const [statusMessage, setStatusMessage] = useState(
    "Arahkan kamera ke QR container atau tempel payload manual. Sistem akan menampilkan preview dulu sebelum transaksi disimpan."
  );
  const [scanTone, setScanTone] = useState<ScanTone>("idle");

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
  };

  const runPreview = async (
    nextContainerId: string,
    rawPayload: string,
    source: "camera" | "manual"
  ) => {
    if (isBusyRef.current) {
      return;
    }

    isBusyRef.current = true;
    setIsPreviewing(true);
    setCameraError(null);
    setPreviewError(null);
    setTransactionError(null);
    setPreviewResult(null);
    setTransactionResult(null);
    setDetectedPayload(rawPayload);
    setScanTone("processing");
    setStatusTitle("Memvalidasi scan...");
    setStatusMessage(
      source === "camera"
        ? "QR sudah terbaca. Sistem sedang menyiapkan preview transaksi."
        : "Payload manual diterima. Sistem sedang menyiapkan preview transaksi."
    );

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setScanTone("preview");
      setStatusTitle("Mode Offline Terdeteksi");
      setStatusMessage(
        "Koneksi internet terputus. Anda tetap bisa mengantrekan scan ini untuk disinkronkan otomatis saat online nanti."
      );
      setPreviewResult({
        authenticatedStudent: {
          id: studentId,
          name: studentName,
          nis: studentNis
        },
        message: "Preview offline siap dikonfirmasi dan diantrikan lokal.",
        transactionRecorded: false,
        validation: {
          actionPreview: "IN", // Dummy but we'll handle it
          container: {
            createdAt: new Date().toISOString(),
            id: nextContainerId,
            isActive: true,
            location: "Lokasi Offline",
            name: "Container Offline",
            qrCode: rawPayload,
            updatedAt: new Date().toISOString()
          },
          lastTransaction: null,
          penaltyStatus: undefined,
          rules: {
            allowedAt: "Sekarang",
            currentLocalTime: "Sekarang",
            endsAt: "Nanti",
            isAllowed: true,
            scheduleType: "REGULAR_IN",
            timeZone: "WIB"
          },
          transactionTypePreview: "REGULAR",
          validatedTimestamp: new Date().toISOString(),
          activeApproval: null
        }
      });
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
      setScanTone(getPreviewTone(result));
      setStatusTitle(getPreviewTitle(result));
      setStatusMessage(getPreviewMessage(result));
      triggerVibration(result.validation.rules.isAllowed ? 30 : [40, 30, 40]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Preview scan gagal diproses.";

      setPreviewError(message);
      setScanTone("error");
      setStatusTitle("Preview belum berhasil");
      setStatusMessage(message);
      triggerVibration([50, 40, 50]);
    } finally {
      isBusyRef.current = false;
      setIsPreviewing(false);
    }
  };

  const processFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || isBusyRef.current) {
      return;
    }

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
          const code = jsQR(imageData.data, width, height, {
            inversionAttempts: "attemptBoth"
          });

          if (code?.data) {
            const nextContainerId = extractContainerId(code.data);

            if (nextContainerId) {
              setManualValue(code.data);
              stopCamera();
              void runPreview(nextContainerId, code.data, "camera");
              return;
            }

            setCameraError(
              "QR terdeteksi, tetapi formatnya bukan QR container sekolah."
            );
            setScanTone("error");
            setStatusTitle("QR tidak dikenali");
            setStatusMessage(
              "Pastikan QR yang dipindai adalah QR container resmi sekolah."
            );
          }
        }
      }
    }

    frameRef.current = requestAnimationFrame(processFrame);
  };

  const startCamera = async (preserveManualValue = false) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser ini tidak mendukung akses kamera.");
      setScanTone("error");
      setStatusTitle("Kamera belum tersedia");
      setStatusMessage("Gunakan input manual jika kamera perangkat tidak didukung.");
      return;
    }

    stopCamera();
    setIsStartingCamera(true);

    if (!preserveManualValue) {
      setManualValue("");
      setDetectedPayload(null);
    }

    clearFlowState();
    setScanTone("processing");
    setStatusTitle("Meminta izin kamera...");
    setStatusMessage("Izinkan akses kamera agar scan bisa dimulai.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            ideal: "environment"
          }
        }
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("Elemen video tidak tersedia.");
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setIsCameraActive(true);
      setScanTone("live");
      setStatusTitle("Arahkan ke QR container");
      setStatusMessage(
        "Saat QR terbaca, sistem akan menampilkan preview transaksi sebelum status HP diubah."
      );
      frameRef.current = requestAnimationFrame(processFrame);
    } catch (error) {
      stopCamera();
      setCameraError(
        error instanceof Error ? error.message : "Gagal mengaktifkan kamera."
      );
      setScanTone("error");
      setStatusTitle("Kamera belum bisa dipakai");
      setStatusMessage("Gunakan input manual bila kamera belum tersedia.");
    } finally {
      setIsStartingCamera(false);
    }
  };

  useEffect(() => {
    void startCamera();
  }, []);

  const handleManualChange = (event: ChangeEvent<HTMLInputElement>) => {
    setManualValue(event.target.value);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedValue = manualValue.trim();
    const nextContainerId = extractContainerId(trimmedValue);

    if (!nextContainerId) {
      setPreviewError(
        "Input manual belum valid. Format yang diterima adalah container://{container_id}."
      );
      setScanTone("error");
      setStatusTitle("Format belum sesuai");
      setStatusMessage("Periksa lagi payload QR sebelum dikirim.");
      return;
    }

    stopCamera();
    await runPreview(nextContainerId, trimmedValue, "manual");
  };

  const handleConfirmTransaction = async () => {
    if (!previewResult || !previewResult.validation.rules.isAllowed) {
      return;
    }

    if (isBusyRef.current) {
      return;
    }

    isBusyRef.current = true;
    setIsSubmittingTransaction(true);
    setTransactionError(null);
    setTransactionResult(null);
    setScanTone("processing");
    setStatusTitle("Menyimpan transaksi...");
    setStatusMessage("Transaksi sedang dicatat ke sistem.");

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

        setScanTone("success-in");
        setStatusTitle("Scan Diantrekan");
        setStatusMessage(
          "Scan Anda sudah disimpan secara lokal. Sistem akan mengirimkannya otomatis saat Anda kembali online (TTL sinkronisasi 30 menit)."
        );
        toast.info("Offline: Scan disimpan secara lokal");
        triggerVibration(90);
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

      const isInAction = result.transaction.action === "IN";

      setTransactionResult(result);
      setScanTone(isInAction ? "success-in" : "success-out");
      setStatusTitle(
        isInAction ? "HP berhasil disimpan" : "HP berhasil diambil"
      );
      setStatusMessage(result.message);
      toast.success(result.message);
      triggerVibration(isInAction ? 90 : [60, 40, 60]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof navigator !== "undefined" && !navigator.onLine
            ? "Gagal menyimpan ke buffer lokal."
            : "Transaksi gagal diproses.";

      setTransactionError(message);
      setScanTone("error");
      setStatusTitle("Konfirmasi belum berhasil");
      setStatusMessage(message);
      toast.error(message);
      triggerVibration([50, 40, 50]);
    } finally {
      isBusyRef.current = false;
      setIsSubmittingTransaction(false);
    }
  };

  const handleScanAgain = () => {
    isBusyRef.current = false;
    setScanTone("idle");
    setStatusTitle("Menyiapkan scan berikutnya...");
    setStatusMessage("Silakan arahkan kembali kamera ke QR container.");
    void startCamera();
  };

  const previewAction = previewResult?.validation.actionPreview ?? null;
  const canConfirmPreview = Boolean(previewResult?.validation.rules.isAllowed);
  const shouldShowScanAgain = Boolean(
    previewResult || transactionResult || previewError || transactionError || cameraError
  );
  const showOpenCameraButton =
    !isCameraActive && !previewResult && !transactionResult && !isStartingCamera;

  return (
    <section className="scanner-mobile-shell">
      <div className={`scanner-panel scanner-focus-panel tone-${scanTone}`}>
        <div className="scanner-student-card scanner-student-card-compact">
          <span className="panel-tag">Siswa Aktif</span>
          <strong>{studentName}</strong>
          <p>
            NIS {studentNis} | Kelas {studentClassName}
          </p>
        </div>

        <div className="camera-shell live-camera-shell scan-stage-shell">
          <video
            autoPlay
            className="scanner-video"
            muted
            playsInline
            ref={videoRef}
          />
          <canvas className="scanner-canvas" ref={canvasRef} />
          <div className="camera-reticle" aria-hidden="true" />
          {!isCameraActive ? (
            <div className="scan-stage-overlay">
              <span className="scan-stage-overlay-label">Preview aman</span>
              <strong>
                {isPreviewing || isSubmittingTransaction
                  ? "Memproses..."
                  : "Kamera siap untuk scan berikutnya"}
              </strong>
            </div>
          ) : null}
          <p className="camera-label">
            {isCameraActive
              ? "QR akan dibaca lalu ditampilkan sebagai preview"
              : "Gunakan kamera atau payload manual"}
          </p>
        </div>

        <div className="panel-header">
          <span className="panel-tag">Status Scan</span>
          <h2>{statusTitle}</h2>
        </div>
        <p className="lead compact-lead">{statusMessage}</p>

        {detectedPayload ? (
          <div className="scan-status-card">
            <span className="summary-label">QR terakhir</span>
            <strong>{detectedPayload}</strong>
          </div>
        ) : null}

        {previewResult ? (
          <div className="scan-result-card scan-preview-card">
            <span className="panel-tag">Preview Transaksi</span>
            <h3>{getActionLabel(previewResult.validation.actionPreview)}</h3>
            <p className="container-meta">
              {previewResult.validation.container.name} |{" "}
              {previewResult.validation.container.location}
            </p>
            <div className="container-meta-grid">
              <div>
                <span className="summary-label">Jenis transaksi</span>
                <strong>{previewResult.validation.transactionTypePreview}</strong>
              </div>
              <div>
                <span className="summary-label">Waktu preview</span>
                <strong>{formatDateTime(previewResult.validation.validatedTimestamp)}</strong>
              </div>
              <div>
                <span className="summary-label">Aksi terakhir</span>
                <strong>
                  {previewResult.validation.lastTransaction
                    ? `${previewResult.validation.lastTransaction.action} ${previewResult.validation.lastTransaction.type}`
                    : "Belum ada transaksi"}
                </strong>
              </div>
            </div>
            {previewResult.validation.activeApproval ? (
              <div className="approval-inline-card">
                <span className="summary-label">Approval aktif</span>
                <strong>
                  {previewResult.validation.activeApproval.type} oleh{" "}
                  {previewResult.validation.activeApproval.approvedBy.name}
                </strong>
                <p className="session-meta">
                  Aktif sejak{" "}
                  {formatDateTime(previewResult.validation.activeApproval.approvedAt)}
                </p>
              </div>
            ) : null}
            {previewResult.validation.penaltyStatus?.isPenalized ? (
              <div className="scan-blocking-note">
                <span className="summary-label">Status penalti</span>
                <strong>
                  {getPenaltyLabel(previewResult.validation.penaltyStatus.type)}
                </strong>
                <p className="session-meta">
                  {previewResult.validation.penaltyStatus.message}
                </p>
              </div>
            ) : null}
            {!previewResult.validation.penaltyStatus?.isPenalized &&
            !previewResult.validation.rules.isAllowed ? (
              <div className="scan-blocking-note">
                <span className="summary-label">Perlu tindakan</span>
                <strong>
                  {previewResult.validation.rules.scheduleType === "REGULAR_IN"
                    ? `Simpan HP hanya boleh ${previewResult.validation.rules.allowedAt} - ${previewResult.validation.rules.endsAt}`
                    : `Ambil HP reguler mulai ${previewResult.validation.rules.allowedAt}`}
                </strong>
                <p className="session-meta">
                  Gunakan jam operasional sekolah atau minta approval guru bila
                  perlu.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {cameraError ? <p className="form-error">{cameraError}</p> : null}
        {previewError ? <p className="form-error">{previewError}</p> : null}
        {transactionError ? <p className="form-error">{transactionError}</p> : null}

        {transactionResult ? (
          <div
            className={`scan-result-card scan-result-card-prominent ${
              transactionResult.transaction.action === "IN"
                ? "is-in"
                : "is-out"
            }`}
          >
            <span className="panel-tag">Status Terbaru</span>
            <h3>{getActionLabel(transactionResult.transaction.action)}</h3>
            <p className="container-meta">
              {transactionResult.validation.container.name} |{" "}
              {transactionResult.validation.container.location}
            </p>
            <div className="container-meta-grid">
              <div>
                <span className="summary-label">Waktu</span>
                <strong>{formatDateTime(transactionResult.transaction.timestamp)}</strong>
              </div>
              <div>
                <span className="summary-label">Jenis</span>
                <strong>{transactionResult.transaction.type}</strong>
              </div>
              <div>
                <span className="summary-label">Aksi berikutnya</span>
                <strong>
                  {transactionResult.transaction.action === "IN" ? "OUT" : "IN"}
                </strong>
              </div>
            </div>
            {transactionResult.consumedApproval ? (
              <p className="session-meta">
                Approval{" "}
                <strong>{transactionResult.consumedApproval.type}</strong> dari{" "}
                <strong>{transactionResult.consumedApproval.approvedBy.name}</strong>{" "}
                sudah dipakai pada transaksi ini.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="scanner-controls scan-primary-actions">
          {showOpenCameraButton ? (
            <button
              className="primary-button scan-action-button"
              disabled={isStartingCamera || isPreviewing || isSubmittingTransaction}
              onClick={() => {
                void startCamera(true);
              }}
              type="button"
            >
              {isStartingCamera ? "Membuka kamera..." : "Buka kamera"}
            </button>
          ) : null}

          {previewAction ? (
            <button
              className="primary-button scan-action-button"
              disabled={!canConfirmPreview || isSubmittingTransaction || isPreviewing}
              onClick={() => {
                void handleConfirmTransaction();
              }}
              type="button"
            >
              {isSubmittingTransaction
                ? "Menyimpan transaksi..."
                : getConfirmLabel(previewAction)}
            </button>
          ) : null}

          {shouldShowScanAgain ? (
            <button
              className="secondary-button scan-action-button"
              disabled={isStartingCamera || isPreviewing || isSubmittingTransaction}
              onClick={() => {
                handleScanAgain();
              }}
              type="button"
            >
              Scan lagi
            </button>
          ) : null}
        </div>

        <div className="scan-manual-panel">
          <div className="panel-header">
            <span className="panel-tag">Input Manual</span>
            <h2>Gunakan payload QR jika kamera bermasalah</h2>
          </div>
          <form className="scan-fallback-form" onSubmit={handleManualSubmit}>
            <label className="field-group">
              <span>Payload QR container</span>
              <input
                className="text-input"
                onChange={handleManualChange}
                placeholder="container://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                type="text"
                value={manualValue}
              />
            </label>
            <button
              className="secondary-button"
              disabled={isPreviewing || isSubmittingTransaction || isStartingCamera}
              type="submit"
            >
              Lihat preview manual
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
