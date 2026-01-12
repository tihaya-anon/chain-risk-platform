package com.chainrisk.graph.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

/**
 * Annotation for validating Ethereum addresses
 */
@Documented
@Constraint(validatedBy = EthAddressValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidEthAddress {
    String message() default "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
