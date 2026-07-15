"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FileUp, FileX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Client-side cap, deliberately under the 5 MB Server Action body limit set
 * in next.config.ts: parsed rows serialize with repeated JSON keys, so the
 * action payload can outgrow the file itself. Rejecting here means an
 * oversized file never reaches a server action (which would 413 and crash).
 */
const MAX_FILE_MB = 4.5;
const MAX_FILE_BYTES = Math.floor(MAX_FILE_MB * 1024 * 1024);

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  onFileAccepted: (file: File) => void;
  disabled?: boolean;
};

export function FileDropzone({ onFileAccepted, disabled }: Props) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors.some((e) => e.code === "file-too-large")) {
          setError(
            `File is too large (${formatMB(rejection.file.size)}). Maximum size is ${MAX_FILE_MB} MB.`,
          );
        } else if (rejection.errors.some((e) => e.code === "too-many-files")) {
          setError("Please upload one file at a time.");
        } else {
          setError("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileAccepted(acceptedFiles[0]);
      }
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_BYTES,
    disabled,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <FileUp className="h-10 w-10 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm font-medium">Drop your file here...</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              Drag & drop a file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              CSV, XLSX, or XLS — up to {MAX_FILE_MB} MB
            </p>
          </>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          <FileX className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
