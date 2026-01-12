import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from "@nestjs/common";

// Ethereum address regex
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  "--",
  ";--",
  "/*",
  "*/",
  "@@",
  "alter ",
  "create ",
  "delete ",
  "drop ",
  "exec(",
  "execute(",
  "insert ",
  "select ",
  "update ",
  "union ",
  "xp_",
];

// XSS patterns
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<embed/gi,
  /<object/gi,
];

/**
 * Sanitize pipe for removing dangerous content from inputs
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (typeof value === "string") {
      return this.sanitizeString(value);
    }

    if (typeof value === "object" && value !== null) {
      return this.sanitizeObject(value);
    }

    return value;
  }

  private sanitizeString(input: string): string {
    let result = input;

    // Remove null bytes
    result = result.replace(/\x00/g, "");

    // Remove XSS patterns
    for (const pattern of XSS_PATTERNS) {
      result = result.replace(pattern, "");
    }

    // HTML encode special characters
    result = result
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");

    return result.trim();
  }

  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = this.sanitizeString(value);
      } else if (typeof value === "object" && value !== null) {
        result[key] = Array.isArray(value)
          ? value.map((v) =>
              typeof v === "string"
                ? this.sanitizeString(v)
                : this.sanitizeObject(v),
            )
          : this.sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

/**
 * Validation pipe for Ethereum addresses
 */
@Injectable()
export class EthAddressValidationPipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value) {
      throw new BadRequestException("Address is required");
    }

    // Check for SQL injection
    if (this.hasSqlInjection(value)) {
      throw new BadRequestException("Invalid characters in address");
    }

    // Validate Ethereum address format
    if (!ETH_ADDRESS_REGEX.test(value)) {
      throw new BadRequestException(
        "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
      );
    }

    return value.toLowerCase();
  }

  private hasSqlInjection(input: string): boolean {
    const lower = input.toLowerCase();
    return SQL_INJECTION_PATTERNS.some((pattern) => lower.includes(pattern));
  }
}

/**
 * Input validation pipe combining sanitization and SQL injection checks
 */
@Injectable()
export class InputValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (typeof value === "string") {
      return this.validateString(value);
    }

    if (typeof value === "object" && value !== null) {
      return this.validateObject(value);
    }

    return value;
  }

  private validateString(input: string): string {
    // Check for SQL injection
    if (this.hasSqlInjection(input)) {
      throw new BadRequestException("Invalid characters in input");
    }

    // Remove null bytes and trim
    return input.replace(/\x00/g, "").trim();
  }

  private validateObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = this.validateString(value);
      } else if (typeof value === "object" && value !== null) {
        result[key] = Array.isArray(value)
          ? value.map((v) =>
              typeof v === "string" ? this.validateString(v) : v,
            )
          : this.validateObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private hasSqlInjection(input: string): boolean {
    const lower = input.toLowerCase();
    return SQL_INJECTION_PATTERNS.some((pattern) => lower.includes(pattern));
  }
}

/**
 * Request size validation constants
 */
export const REQUEST_SIZE_LIMITS = {
  maxBodySize: 1024 * 1024, // 1MB
  maxUrlLength: 2048,
};
