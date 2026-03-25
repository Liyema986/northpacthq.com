"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SignaturePad } from "@/components/signature/SignaturePad";
import { CheckCircle, AlertTriangle, FileText, Clock, Shield } from "lucide-react";
import { toast } from "sonner";

export default function SigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [signerName, setSignerName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [clientInfo, setClientInfo] = useState({ ip: "", userAgent: "" });

  const signingSession = useQuery(api.signatures.getSigningSession, { token });
  const submitSignature = useMutation(api.signatures.submitSignature);

  // Get client info on mount
  useEffect(() => {
    setClientInfo({
      ip: "Client IP", // In production, get from API route
      userAgent: navigator.userAgent,
    });
  }, []);

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!signatureData) {
      toast.error("Please provide your signature");
      return;
    }
    if (!agreedToTerms) {
      toast.error("Please agree to the terms");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitSignature({
        token,
        signerName: signerName.trim(),
        signatureImage: signatureData,
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      });

      setIsComplete(true);
      toast.success("Document signed successfully!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Error state
  if (signingSession?.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <CardTitle>Unable to Sign</CardTitle>
            <CardDescription>{signingSession.error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Please contact the sender if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (!signingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground animate-pulse mb-4" />
            <p>Loading document...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <CardTitle className="text-2xl">Successfully Signed!</CardTitle>
            <CardDescription>
              Thank you for signing the engagement letter
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              A copy of the signed document has been sent to your email address.
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm font-medium">Document Details</p>
              <p className="text-sm text-muted-foreground">
                {signingSession.letter?.letterNumber}
              </p>
              <p className="text-sm text-muted-foreground">
                Signed by: {signerName}
              </p>
              <p className="text-sm text-muted-foreground">
                Date: {new Date().toLocaleDateString()}
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-xs text-muted-foreground text-center">
              You may close this window
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {signingSession.firmName}
                </CardTitle>
                <CardDescription>
                  Engagement Letter • {signingSession.letter?.letterNumber}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{signingSession.clientName}</p>
                <p className="text-xs text-muted-foreground">Client</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Document Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document to Sign</CardTitle>
            <CardDescription>
              Please review the engagement letter carefully before signing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] border rounded-lg bg-white p-4">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: signingSession.letter?.content || "",
                }}
              />
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Signature Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Signature</CardTitle>
            <CardDescription>
              Sign below to accept the terms of this engagement letter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="signer-name">Full Legal Name *</Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full legal name"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Signature *</Label>
              <div className="mt-1">
                <SignaturePad
                  onSignatureChange={setSignatureData}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="agree-terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              />
              <Label htmlFor="agree-terms" className="text-sm leading-relaxed cursor-pointer">
                I have read and agree to the terms of this engagement letter. I understand
                that my electronic signature is legally binding and equivalent to a
                handwritten signature.
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !signerName || !signatureData || !agreedToTerms}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? "Signing..." : "Sign Document"}
            </Button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>
                Your signature is encrypted and stored securely with a complete audit trail
              </span>
            </div>
          </CardFooter>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>Powered by ProProposals • Secure Electronic Signatures</p>
          <p className="mt-1">
            This signing session expires on{" "}
            {signingSession.session?.expiresAt
              ? new Date(signingSession.session.expiresAt).toLocaleDateString()
              : "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
