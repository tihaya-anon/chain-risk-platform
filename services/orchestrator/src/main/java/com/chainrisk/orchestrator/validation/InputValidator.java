package com.chainrisk.orchestrator.validation;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Input validation utility for security checks
 */
@Slf4j
@Component
public class InputValidator {

    private static final Pattern ETH_ADDRESS_PATTERN = 
        Pattern.compile("^0x[a-fA-F0-9]{40}$");

    private static final List<String> SQL_INJECTION_PATTERNS = List.of(
        "--", ";--", "/*", "*/", "@@",
        "alter ", "create ", "delete ", "drop ",
        "exec(", "execute(", "insert ", "select ",
        "update ", "union ", "xp_"
    );

    private static final int MAX_URL_LENGTH = 2048;
    private static final long MAX_BODY_SIZE = 1024 * 1024; // 1MB

    /**
     * Validate Ethereum address format
     */
    public boolean isValidEthAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return ETH_ADDRESS_PATTERN.matcher(address).matches();
    }

    /**
     * Check for SQL injection patterns
     */
    public boolean hasSqlInjection(String input) {
        if (input == null || input.isEmpty()) {
            return false;
        }
        
        String lowerInput = input.toLowerCase();
        for (String pattern : SQL_INJECTION_PATTERNS) {
            if (lowerInput.contains(pattern)) {
                log.warn("Potential SQL injection detected: {}", pattern);
                return true;
            }
        }
        return false;
    }

    /**
     * Sanitize input string
     */
    public String sanitize(String input) {
        if (input == null) {
            return null;
        }
        // Remove null bytes
        input = input.replace("\0", "");
        // Trim whitespace
        return input.trim();
    }

    /**
     * Validate URL length
     */
    public boolean isValidUrlLength(String url) {
        return url == null || url.length() <= MAX_URL_LENGTH;
    }

    /**
     * Validate body size
     */
    public boolean isValidBodySize(long contentLength) {
        return contentLength <= MAX_BODY_SIZE;
    }

    /**
     * Get max URL length
     */
    public int getMaxUrlLength() {
        return MAX_URL_LENGTH;
    }

    /**
     * Get max body size
     */
    public long getMaxBodySize() {
        return MAX_BODY_SIZE;
    }
}
