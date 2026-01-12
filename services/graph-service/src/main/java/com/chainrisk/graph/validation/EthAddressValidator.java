package com.chainrisk.graph.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;

/**
 * Validator for Ethereum addresses
 */
public class EthAddressValidator implements ConstraintValidator<ValidEthAddress, String> {

    private static final Pattern ETH_ADDRESS_PATTERN = 
        Pattern.compile("^0x[a-fA-F0-9]{40}$");

    @Override
    public void initialize(ValidEthAddress constraintAnnotation) {
        // No initialization needed
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        return ETH_ADDRESS_PATTERN.matcher(value).matches();
    }
}
