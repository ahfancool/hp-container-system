import jsQR from "jsqr";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject
} from "react";

import { submitScanValidation, type ScanValidationResponse } from "../lib/scan";
import {
  submitPhoneTransaction,
  type TransactionResponse
} from "../lib/transaction";
import { announceToScreenReader } from "../lib/a11y";

const readinessNotes = [
  "Kamera memakai Browser Camera API melalui getUserMedia.",
  "Decoder QR membaca payload dan mengekstrak container ID dari format container://{container_id}.",
  "Scan dapat divalidasi lebih dulu, lalu dicatat ke database melalui POST /transaction."
];

type ScannerShellProps = {
  accessToken: string;
  studentClassName: string;
  studentId: string;
  studentName: string;
  studentNis: string;
};

function extractContainerId(rawValue: string): string | null {
  const match = /^container:\/\/([0-9a-f-]{36})$/i.exec(rawValue.trim());
  return match?.[1] ?? null;
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

export function ScannerShell({
  accessToken,
  studentClassName,
  studentId,
  studentName,
  studentNis
}: ScannerShellProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecordingTransaction, setIsRecordingTransaction] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [rawScanValue, setRawScanValue] = useState<string | null>(null);
  const [containerId, setContainerId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanValidationResponse | null>(
    null
  );
  const [transactionResult, setTransactionResult] =
    useState<TransactionResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Siap memulai kamera atau menerima input manual."
  );

  const samplePayload = `{
  "student_id": "${studentId}",
  "container_id": "${containerId ?? "container-uuid"}",
  "timestamp": "${new Date().toISOString()}"
}`;

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

  const processFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
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

            setRawScanValue(code.data);

            if (nextContainerId) {
              setContainerId(nextContainerId);
              setManualValue(code.data);
              setCameraError(null);
              setStatusMessage("QR container terdeteksi. Siap dikirim ke backend.");
              stopCamera();
              return;
            }

            setCameraError(
              "QR terdeteksi, tetapi formatnya bukan container://{container_id}."
            );
          }
        }
      }
    }

    frameRef.current = requestAnimationFrame(processFrame);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser ini tidak mendukung akses kamera.");
      return;
    }

    setIsStartingCamera(true);
    setCameraError(null);
    setSubmitError(null);
    setTransactionError(null);
    setScanResult(null);
    setTransactionResult(null);
    setStatusMessage("Meminta izin kamera...");

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
      setStatusMessage("Kamera aktif. Arahkan ke QR container.");
      frameRef.current = requestAnimationFrame(processFrame);
    } catch (error) {
      stopCamera();
      setCameraError(
        error instanceof Error
          ? error.message
          : "Gagal mengaktifkan kamera."
      );
      setStatusMessage("Kamera gagal diaktifkan. Gunakan input manual bila perlu.");
    } finally {
      setIsStartingCamera(false);
    }
  };

  const applyManualValue = (value: string) => {
    const parsedContainerId = extractContainerId(value);

    setRawScanValue(value || null);
    setContainerId(parsedContainerId);
    setScanResult(null);
    setSubmitError(null);
    setTransactionError(null);
    setTransactionResult(null);

    if (parsedContainerId) {
      setCameraError(null);
      setStatusMessage("Payload manual valid dan siap dikirim.");
      return;
    }

    setCameraError(
      "Input belum valid. Format yang diterima adalah container://{container_id}."
    );
    setStatusMessage("Periksa lagi payload QR sebelum dikirim.");
  };

  const handleManualChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setManualValue(nextValue);
    applyManualValue(nextValue.trim());
  };

  const handleValidateScan = async () => {
    if (!containerId) {
      setSubmitError("Belum ada container valid yang bisa dikirim.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setScanResult(null);
    setTransactionResult(null);
    setTransactionError(null);

    try {
      const result = await submitScanValidation(accessToken, {
        containerId,
        studentId,
        timestamp: new Date().toISOString()
      });

      setScanResult(result);
      setStatusMessage("Payload scan tervalidasi oleh backend.");
      announceToScreenReader(`Validasi berhasil. Aksi: ${result.validation.actionPreview} di ${result.validation.container.name}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal mengirim scan.";
      setSubmitError(message);
      setStatusMessage("Backend menolak atau gagal memproses payload scan.");
      announceToScreenReader(`Gagal validasi. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordTransaction = async () => {
    if (!containerId) {
      setTransactionError("Belum ada container valid yang bisa dicatat.");
      return;
    }

    setIsRecordingTransaction(true);
    setTransactionError(null);

    try {
      const result = await submitPhoneTransaction(accessToken, {
        containerId,
        studentId,
        timestamp: new Date().toISOString(),
        type: "REGULAR"
      });

      setTransactionResult(result);
      setScanResult({
        authenticatedStudent: result.student,
        message: result.message,
        transactionRecorded: true,
        validation: result.validation
      });
      setStatusMessage("Transaksi berhasil dicatat ke database.");
      announceToScreenReader(`Transaksi berhasil. HP telah ${result.transaction.action === "IN" ? "tersimpan" : "diambil"}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal mencatat transaksi.";
      setTransactionError(message);
      setStatusMessage("Transaksi ditolak atau gagal dicatat.");
      announceToScreenReader(`Gagal mencatat transaksi. ${message}`);
    } finally {
      setIsRecordingTransaction(false);
    }
  };

  const handleReset = () => {
    stopCamera();
    setManualValue("");
    setRawScanValue(null);
    setContainerId(null);
    setCameraError(null);
    setSubmitError(null);
    setTransactionError(null);
    setScanResult(null);
    setTransactionResult(null);
    setStatusMessage("Scanner direset. Siap untuk scan berikutnya.");
  };

  return (
    <section className="scanner-layout">
      <div className="scanner-panel">
        <div className="scanner-student-card">
          <span className="panel-tag">Siswa Aktif</span>
          <strong>{studentName}</strong>
          <p>
            NIS {studentNis} | Kelas {studentClassName}
          </p>
        </div>

        <div className="camera-shell live-camera-shell">
          <video
            autoPlay
            className="scanner-video"
            muted
            playsInline
            ref={videoRef}
            aria-label="Kamera scanner QR"
          />
          <canvas className="scanner-canvas" ref={canvasRef} aria-hidden="true" />
          <div className="camera-reticle" aria-hidden="true" />
          <p className="camera-label" aria-live="polite">
            {isCameraActive ? "Arahkan kamera ke QR container" : "Kamera belum aktif"}
          </p>
        </div>

        <div className="scanner-controls">
          <button
            className="primary-button"
            disabled={isStartingCamera || isCameraActive}
            onClick={() => {
              void startCamera();
            }}
            type="button"
            aria-label={isStartingCamera ? "Mengaktifkan kamera..." : "Aktifkan kamera scanner"}
          >
            {isStartingCamera ? "Mengaktifkan kamera..." : "Aktifkan kamera"}
          </button>
          <button
            className="secondary-button"
            disabled={!isCameraActive}
            onClick={() => {
              stopCamera();
              setStatusMessage("Kamera dihentikan.");
              announceToScreenReader("Kamera scanner dihentikan.");
            }}
            type="button"
            aria-label="Hentikan kamera scanner"
          >
            Hentikan kamera
          </button>
          <button
            className="secondary-button"
            onClick={handleReset}
            type="button"
            aria-label="Reset hasil scan"
          >
            Reset scan
          </button>
        </div>

        <label className="field-group">
          <span>Input manual payload QR</span>
          <input
            className="text-input"
            onChange={handleManualChange}
            placeholder="container://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            type="text"
            value={manualValue}
            aria-label="Manual QR payload input"
          />
        </label>

        <div className="scan-status-card" role="status">
          <span className="summary-label">Status scanner</span>
          <strong>{statusMessage}</strong>
          {rawScanValue ? (
            <p className="container-meta">
              Payload terbaca: <code>{rawScanValue}</code>
            </p>
          ) : null}
          {containerId ? (
            <p className="container-meta">
              Container ID: <code>{containerId}</code>
            </p>
          ) : null}
        </div>

        {cameraError ? <p className="form-error">{cameraError}</p> : null}
      </div>

      <div className="scanner-panel">
        <div className="panel-header">
          <span className="panel-tag">Validasi dan Transaksi</span>
          <h2>Payload scan, preview aksi, dan hasil pencatatan</h2>
        </div>
        <pre className="payload-preview">{samplePayload}</pre>
        <div className="scanner-controls">
          <button
            className="primary-button"
            disabled={!containerId || isSubmitting}
            onClick={() => {
              void handleValidateScan();
            }}
            type="button"
          >
            {isSubmitting ? "Mengirim..." : "Kirim validasi scan"}
          </button>
          <button
            className="primary-button"
            disabled={!containerId || isRecordingTransaction}
            onClick={() => {
              void handleRecordTransaction();
            }}
            type="button"
          >
            {isRecordingTransaction ? "Mencatat..." : "Catat transaksi"}
          </button>
        </div>
        {submitError ? <p className="form-error">{submitError}</p> : null}
        {transactionError ? <p className="form-error">{transactionError}</p> : null}
        {scanResult ? (
          <div className="scan-result-card">
            <span className="panel-tag">Hasil Validasi</span>
            <h3>{scanResult.validation.container.name}</h3>
            <p className="container-meta">{scanResult.validation.container.location}</p>
            <div className="container-meta-grid">
              <div>
                <span className="summary-label">Aksi preview</span>
                <strong>{scanResult.validation.actionPreview}</strong>
              </div>
              <div>
                <span className="summary-label">Timestamp tervalidasi</span>
                <strong>{scanResult.validation.validatedTimestamp}</strong>
              </div>
            </div>
            <div className="qr-payload-block">
              <span className="summary-label">QR payload</span>
              <code>{scanResult.validation.container.qrCode}</code>
            </div>
            <p className="container-meta">{scanResult.message}</p>
            {scanResult.validation.lastTransaction ? (
              <p className="container-meta">
                Transaksi terakhir: {scanResult.validation.lastTransaction.action}{" "}
                {scanResult.validation.lastTransaction.type} pada{" "}
                {scanResult.validation.lastTransaction.timestamp}
              </p>
            ) : (
              <p className="container-meta">
                Belum ada transaksi sebelumnya. Preview aksi awal adalah `IN`.
              </p>
            )}
          </div>
        ) : null}
        {transactionResult ? (
          <div className="scan-result-card">
            <span className="panel-tag">Transaksi Tercatat</span>
            <h3>
              {transactionResult.transaction.action}{" "}
              {transactionResult.transaction.type}
            </h3>
            <p className="container-meta">{transactionResult.message}</p>
            <div className="container-meta-grid">
              <div>
                <span className="summary-label">Transaction ID</span>
                <strong>{transactionResult.transaction.id}</strong>
              </div>
              <div>
                <span className="summary-label">Request ID</span>
                <strong>{transactionResult.idempotency.requestId ?? "-"}</strong>
              </div>
              <div>
                <span className="summary-label">Waktu transaksi</span>
                <strong>{transactionResult.transaction.timestamp}</strong>
              </div>
              <div>
                <span className="summary-label">Zona sekolah</span>
                <strong>{transactionResult.rules.timeZone}</strong>
              </div>
              <div>
                <span className="summary-label">Batas OUT reguler</span>
                <strong>
                  {transactionResult.rules.allowedAt} | sekarang{" "}
                  {transactionResult.rules.currentLocalTime}
                </strong>
              </div>
            </div>
            {transactionResult.idempotency.replayed ? (
              <p className="container-meta">
                Response ini berasal dari replay aman request yang sama, jadi
                backend tidak menulis transaksi baru kedua kali.
              </p>
            ) : null}
          </div>
        ) : null}
        <ul className="readiness-list">
          {readinessNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
