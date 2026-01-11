/**
 * JSON Schema validation helpers for k6
 * Lightweight schema validation without external dependencies
 */

export function validateSchema(data, schema) {
    const errors = [];
    validateNode(data, schema, '', errors);
    return {
        valid: errors.length === 0,
        errors,
    };
}

function validateNode(data, schema, path, errors) {
    if (schema === null || schema === undefined) return;
    
    // Handle $ref (not resolved, just skip)
    if (schema.$ref) return;
    
    // Handle anyOf/oneOf
    if (schema.anyOf) {
        const anyValid = schema.anyOf.some(s => validateSchema(data, s).valid);
        if (!anyValid) {
            errors.push(`${path || 'root'}: does not match any of the anyOf schemas`);
        }
        return;
    }
    
    // Type validation
    if (schema.type) {
        const types = Array.isArray(schema.type) ? schema.type : [schema.type];
        const actualType = getType(data);
        
        if (!types.includes(actualType) && !(types.includes('null') && data === null)) {
            errors.push(`${path || 'root'}: expected ${types.join('|')}, got ${actualType}`);
            return;
        }
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
        errors.push(`${path || 'root'}: value must be one of [${schema.enum.join(', ')}]`);
    }
    
    // Number constraints
    if (typeof data === 'number') {
        if (schema.minimum !== undefined && data < schema.minimum) {
            errors.push(`${path || 'root'}: ${data} < minimum ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && data > schema.maximum) {
            errors.push(`${path || 'root'}: ${data} > maximum ${schema.maximum}`);
        }
    }
    
    // String constraints
    if (typeof data === 'string') {
        if (schema.minLength !== undefined && data.length < schema.minLength) {
            errors.push(`${path || 'root'}: length ${data.length} < minLength ${schema.minLength}`);
        }
        if (schema.maxLength !== undefined && data.length > schema.maxLength) {
            errors.push(`${path || 'root'}: length ${data.length} > maxLength ${schema.maxLength}`);
        }
        if (schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(data)) {
                errors.push(`${path || 'root'}: does not match pattern ${schema.pattern}`);
            }
        }
    }
    
    // Object validation
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        // Required properties
        if (schema.required) {
            for (const prop of schema.required) {
                if (!(prop in data)) {
                    errors.push(`${path || 'root'}: missing required property '${prop}'`);
                }
            }
        }
        
        // Property validation
        if (schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                if (key in data) {
                    validateNode(data[key], propSchema, `${path}.${key}`, errors);
                }
            }
        }
    }
    
    // Array validation
    if (Array.isArray(data)) {
        if (schema.minItems !== undefined && data.length < schema.minItems) {
            errors.push(`${path || 'root'}: array length ${data.length} < minItems ${schema.minItems}`);
        }
        if (schema.maxItems !== undefined && data.length > schema.maxItems) {
            errors.push(`${path || 'root'}: array length ${data.length} > maxItems ${schema.maxItems}`);
        }
        if (schema.items) {
            data.forEach((item, i) => {
                validateNode(item, schema.items, `${path}[${i}]`, errors);
            });
        }
    }
}

function getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

// Quick field checkers
export function hasFields(obj, fields) {
    if (!obj || typeof obj !== 'object') return false;
    return fields.every(f => f in obj);
}

export function isValidAddress(addr) {
    return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function isValidTxHash(hash) {
    return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function isInRange(value, min, max) {
    return typeof value === 'number' && value >= min && value <= max;
}

export function isValidRiskLevel(level) {
    return ['low', 'medium', 'high', 'critical'].includes(level);
}

export function isValidSeverity(severity) {
    return ['low', 'medium', 'high', 'critical'].includes(severity);
}

export function isISODate(str) {
    if (typeof str !== 'string') return false;
    const d = new Date(str);
    return !isNaN(d.getTime());
}

export default {
    validateSchema,
    hasFields,
    isValidAddress,
    isValidTxHash,
    isInRange,
    isValidRiskLevel,
    isValidSeverity,
    isISODate,
};
