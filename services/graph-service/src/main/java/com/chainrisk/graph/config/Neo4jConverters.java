package com.chainrisk.graph.config;

import org.neo4j.driver.Value;
import org.neo4j.driver.types.IsoDuration;
import org.springframework.core.convert.TypeDescriptor;
import org.springframework.core.convert.converter.GenericConverter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * Custom converters for Neo4j type mappings.
 * Handles conversion between Neo4j stored values and Java types.
 */
public final class Neo4jConverters {

    private Neo4jConverters() {
        // Utility class
    }

    /**
     * Converter that handles Long (epoch milliseconds) to Instant conversion.
     * Neo4j stores timestamps as Long values, but our entity uses Instant.
     */
    public static class LongToInstantConverter implements GenericConverter {

        @Override
        public Set<ConvertiblePair> getConvertibleTypes() {
            Set<ConvertiblePair> convertiblePairs = new HashSet<>();
            convertiblePairs.add(new ConvertiblePair(Long.class, Instant.class));
            convertiblePairs.add(new ConvertiblePair(Value.class, Instant.class));
            return convertiblePairs;
        }

        @Override
        public Object convert(Object source, TypeDescriptor sourceType, TypeDescriptor targetType) {
            if (source == null) {
                return null;
            }

            if (source instanceof Long epochMillis) {
                return Instant.ofEpochMilli(epochMillis);
            }

            if (source instanceof Value value) {
                if (value.isNull()) {
                    return null;
                }
                // Handle Neo4j Integer/Long value
                if (!value.type().name().equals("NULL")) {
                    try {
                        long epochMillis = value.asLong();
                        return Instant.ofEpochMilli(epochMillis);
                    } catch (Exception e) {
                        // If it's already a temporal type, let default handling work
                        try {
                            return value.asZonedDateTime().toInstant();
                        } catch (Exception ex) {
                            throw new IllegalArgumentException(
                                "Cannot convert value " + source + " to Instant", ex);
                        }
                    }
                }
            }

            throw new IllegalArgumentException(
                "Cannot convert " + source.getClass().getName() + " to Instant");
        }
    }

    /**
     * Converter that handles Instant to Long (epoch milliseconds) conversion.
     * Used when writing Instant values back to Neo4j as Long.
     */
    public static class InstantToLongConverter implements GenericConverter {

        @Override
        public Set<ConvertiblePair> getConvertibleTypes() {
            Set<ConvertiblePair> convertiblePairs = new HashSet<>();
            convertiblePairs.add(new ConvertiblePair(Instant.class, Long.class));
            return convertiblePairs;
        }

        @Override
        public Object convert(Object source, TypeDescriptor sourceType, TypeDescriptor targetType) {
            if (source == null) {
                return null;
            }

            if (source instanceof Instant instant) {
                return instant.toEpochMilli();
            }

            throw new IllegalArgumentException(
                "Cannot convert " + source.getClass().getName() + " to Long");
        }
    }
}
