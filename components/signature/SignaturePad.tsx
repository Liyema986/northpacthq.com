"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Pen, Type, RotateCcw, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  onSignatureChange: (signatureData: string | null) => void;
  disabled?: boolean;
  /** Compact draw-only mode for proposal accept (no tabs, pencil-like strokes) */
  proposalMode?: boolean;
  /** In proposalMode: allow uploading a signature image (default true) */
  allowUpload?: boolean;
}

const ACCEPTED_SIGNATURE_TYPES = "image/png,image/jpeg,image/jpg,image/webp";
const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export function SignaturePad({ onSignatureChange, disabled, proposalMode, allowUpload = true }: SignaturePadProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proposalTab, setProposalTab] = useState<"draw" | "upload">("draw");

  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setHasDrawn(false);
    }
    setTypedName("");
    setUploadedImageUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onSignatureChange(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIGNATURE_SIZE_BYTES) {
      setUploadError("Image must be 2MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadedImageUrl(dataUrl);
      onSignatureChange(dataUrl);
    };
    reader.onerror = () => setUploadError("Failed to read file");
    reader.readAsDataURL(file);
  };

  const handleDrawEnd = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setHasDrawn(true);
      const dataUrl = signatureRef.current.toDataURL("image/png");
      onSignatureChange(dataUrl);
    }
  };

  const handleTypedNameChange = (name: string) => {
    setTypedName(name);
    if (name.trim()) {
      // Generate signature image from typed name
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "italic 48px 'Brush Script MT', cursive";
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name, canvas.width / 2, canvas.height / 2);
        const dataUrl = canvas.toDataURL("image/png");
        onSignatureChange(dataUrl);
      }
    } else {
      onSignatureChange(null);
    }
  };

  const handleModeChange = (mode: string) => {
    setSignatureMode(mode as "draw" | "type");
    handleClear();
  };

  // Proposal mode: compact pad with optional Draw | Upload tabs
  if (proposalMode) {
    const activeTab = uploadedImageUrl ? "upload" : hasDrawn ? "draw" : proposalTab;

    return (
      <div className="space-y-3">
        {allowUpload && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const mode = v as "draw" | "upload";
              if (mode === "draw" && uploadedImageUrl) handleClear();
              else if (mode === "upload" && hasDrawn) handleClear();
              setProposalTab(mode);
              setUploadError(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2 h-9 bg-slate-100 dark:bg-slate-800/50">
              <TabsTrigger value="draw" disabled={disabled}>
                <Pen className="h-3.5 w-3.5 mr-1.5" />
                Draw
              </TabsTrigger>
              <TabsTrigger value="upload" disabled={disabled}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload
              </TabsTrigger>
            </TabsList>
            <TabsContent value="draw" className="mt-3">
              <div
                className={cn(
                  "relative w-full border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 shadow-inner overflow-hidden",
                  disabled && "opacity-50 pointer-events-none"
                )}
              >
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    className: "w-full h-32 cursor-crosshair bg-transparent relative z-10",
                    style: { width: "100%", height: "128px" },
                  }}
                  onEnd={handleDrawEnd}
                  penColor="#000000"
                  backgroundColor="rgba(255, 255, 255, 0)"
                  minWidth={1.5}
                  maxWidth={3.5}
                  velocityFilterWeight={0.7}
                  dotSize={1.5}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <span className="text-slate-400 text-sm font-medium">Sign here</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="absolute top-2 right-2 h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full z-20"
                  title="Clear signature"
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="upload" className="mt-3 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_SIGNATURE_TYPES}
                className="hidden"
                onChange={handleFileSelect}
                disabled={disabled}
              />
              {uploadedImageUrl ? (
                <div className="relative border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 p-4 min-h-[128px] flex items-center justify-center">
                  <img
                    src={uploadedImageUrl}
                    alt="Your signature"
                    className="max-h-28 max-w-full object-contain"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="absolute top-2 right-2 h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                    title="Remove signature"
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 rounded-lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                  >
                    <span className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Upload className="h-8 w-8" />
                      <span className="text-sm font-medium">Choose image (PNG, JPG, WebP)</span>
                      <span className="text-xs">Max 2MB</span>
                    </span>
                  </Button>
                  {uploadError && (
                    <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                      {uploadError}
                    </p>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
        {!allowUpload && (
          <div
            className={cn(
              "relative w-full border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 shadow-inner overflow-hidden",
              disabled && "opacity-50 pointer-events-none"
            )}
          >
            <SignatureCanvas
              ref={signatureRef}
              canvasProps={{
                className: "w-full h-32 cursor-crosshair bg-transparent relative z-10",
                style: { width: "100%", height: "128px" },
              }}
              onEnd={handleDrawEnd}
              penColor="#000000"
              backgroundColor="rgba(255, 255, 255, 0)"
              minWidth={1.5}
              maxWidth={3.5}
              velocityFilterWeight={0.7}
              dotSize={1.5}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <span className="text-slate-400 text-sm font-medium">Sign here</span>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute top-2 right-2 h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full z-20"
              title="Clear signature"
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs value={signatureMode} onValueChange={handleModeChange}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="draw" disabled={disabled}>
              <Pen className="h-4 w-4 mr-2" />
              Draw Signature
            </TabsTrigger>
            <TabsTrigger value="type" disabled={disabled}>
              <Type className="h-4 w-4 mr-2" />
              Type Signature
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg bg-white relative",
                disabled && "opacity-50 pointer-events-none"
              )}
            >
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: "w-full h-40 cursor-crosshair bg-transparent",
                  style: { width: "100%", height: "160px" },
                }}
                onEnd={handleDrawEnd}
                penColor="#000000"
                backgroundColor="rgba(255, 255, 255, 0)"
                minWidth={1.5}
                maxWidth={3.5}
                velocityFilterWeight={0.7}
                dotSize={1.5}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Use your mouse or finger to draw your signature above
            </p>
          </TabsContent>

          <TabsContent value="type" className="space-y-4">
            <div>
              <Label htmlFor="typed-signature">Type your full name</Label>
              <Input
                id="typed-signature"
                value={typedName}
                onChange={(e) => handleTypedNameChange(e.target.value)}
                placeholder="Your full legal name"
                disabled={disabled}
                className="text-lg"
              />
            </div>
            {typedName && (
              <div className="border-2 border-dashed rounded-lg bg-white p-8">
                <p
                  className="text-4xl text-center"
                  style={{ fontFamily: "'Brush Script MT', cursive" }}
                >
                  {typedName}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={disabled || (!hasDrawn && !typedName)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
