import { toast } from "sonner";

/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * ERROR HANDLING SYSTEM â€” ERR-### Code Registry
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

export const ERROR_REGISTRY = {
  // Auth Errors (ERR-001 - ERR-099)
  "ERR-001": {
    message: "Please sign in to continue",
    description: "User is not authenticated",
    action: "Redirect to login page",
    severity: "error",
    httpStatus: 401,
  },
  "ERR-002": {
    message: "You don't have permission to do that",
    description: "User lacks required role/permission",
    action: "Contact administrator if you believe this is an error",
    severity: "warning",
    httpStatus: 403,
  },
  
  // Data Errors (ERR-100 - ERR-199)
  "ERR-003": {
    message: "Record not found",
    description: "The requested resource does not exist",
    action: "Check the URL or navigate back",
    severity: "warning",
    httpStatus: 404,
  },
  "ERR-004": {
    message: "Invalid data provided",
    description: "Request validation failed",
    action: "Check your inputs and try again",
    severity: "warning",
    httpStatus: 400,
  },
  "ERR-005": {
    message: "Duplicate entry",
    description: "A record with this information already exists",
    action: "Use different values or update the existing record",
    severity: "warning",
    httpStatus: 409,
  },
  
  // System Errors (ERR-500 - ERR-599)
  "ERR-006": {
    message: "Something went wrong on our end",
    description: "Internal server error",
    action: "Please try again in a few moments",
    severity: "error",
    httpStatus: 500,
  },
  "ERR-007": {
    message: "Network error",
    description: "Unable to connect to server",
    action: "Check your internet connection",
    severity: "error",
    httpStatus: 0,
  },
  "ERR-008": {
    message: "Rate limit exceeded",
    description: "Too many requests",
    action: "Please wait a moment before trying again",
    severity: "warning",
    httpStatus: 429,
  },
  "ERR-009": {
    message: "Service unavailable",
    description: "Backend service is temporarily down",
    action: "Please try again later",
    severity: "error",
    httpStatus: 503,
  },
  "ERR-010": {
    message: "Request timeout",
    description: "Operation took too long",
    action: "Try again with a smaller request",
    severity: "error",
    httpStatus: 504,
  },
} as const;

export type ErrorCode = keyof typeof ERROR_REGISTRY;

/**
 * Handle Convex errors with automatic code extraction and toast display
 */
export function handleConvexError(error: unknown): void {
  console.error("[Error Handler]", error);
  
  if (error instanceof Error) {
    const message = error.message;
    
    // Extract error code
    const codeMatch = message.match(/(ERR-\d{3})/);
    const code = codeMatch ? (codeMatch[1] as ErrorCode) : null;
    
    if (code && code in ERROR_REGISTRY) {
      const errDef = ERROR_REGISTRY[code];
      toast.error(errDef.message, { description: errDef.action });
      return;
    }
    
    // Fallback error detection
    if (message.includes("Authentication") || message.includes("auth")) {
      toast.error(ERROR_REGISTRY["ERR-001"].message, { description: "Please sign in" });
    } else if (message.includes("Permission") || message.includes("access")) {
      toast.error(ERROR_REGISTRY["ERR-002"].message, { description: "Contact admin if needed" });
    } else if (message.includes("not found") || message.includes("404")) {
      toast.error(ERROR_REGISTRY["ERR-003"].message);
    } else if (message.includes("validation") || message.includes("invalid")) {
      toast.error(ERROR_REGISTRY["ERR-004"].message, { description: "Check your inputs" });
    } else {
      toast.error(ERROR_REGISTRY["ERR-006"].message, { description: "Please try again" });
    }
  } else {
    toast.error("An unexpected error occurred");
  }
}

/**
 * Wrapper for async operations with automatic error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options?: {
    onError?: (error: unknown) => void;
    fallback?: T;
    showToast?: boolean;
  }
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (options?.showToast !== false) {
      handleConvexError(error);
    }
    options?.onError?.(error);
    return options?.fallback ?? null;
  }
}
