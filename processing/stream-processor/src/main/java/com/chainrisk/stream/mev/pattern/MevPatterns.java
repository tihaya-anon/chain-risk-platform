package com.chainrisk.stream.mev.pattern;

import com.chainrisk.stream.mev.model.PendingTx;
import org.apache.flink.cep.pattern.Pattern;
import org.apache.flink.cep.pattern.conditions.IterativeCondition;
import org.apache.flink.cep.pattern.conditions.SimpleCondition;
import org.apache.flink.streaming.api.windowing.time.Time;

import java.math.BigInteger;
import java.util.List;

/**
 * CEP patterns for MEV detection
 */
public class MevPatterns {

    private static final BigInteger GAS_PRICE_THRESHOLD = new BigInteger("5000000000"); // 5 Gwei
    private static final long SANDWICH_WINDOW_MS = 12000; // ~1 block
    private static final long FRONTRUN_WINDOW_MS = 6000;

    /**
     * Sandwich Attack Pattern:
     * [FrontTx(token, high_gas)] -> [VictimTx(token)] -> [BackTx(token, from=FrontTx.from)]
     * Within same block window (~12s)
     */
    public static Pattern<PendingTx, ?> sandwichPattern() {
        return Pattern.<PendingTx>begin("front")
            .where(new SimpleCondition<>() {
                @Override
                public boolean filter(PendingTx tx) {
                    return tx.isDexSwap();
                }
            })
            .followedBy("victim")
            .where(new IterativeCondition<>() {
                @Override
                public boolean filter(PendingTx victim, Context<PendingTx> ctx) throws Exception {
                    if (!victim.isDexSwap()) {
                        return false;
                    }
                    for (PendingTx front : ctx.getEventsForPattern("front")) {
                        // Same target contract, different sender
                        if (sameTarget(front, victim) && !front.getFrom().equalsIgnoreCase(victim.getFrom())) {
                            // Front tx has higher gas
                            if (front.getEffectiveGasPrice().compareTo(victim.getEffectiveGasPrice()) > 0) {
                                return true;
                            }
                        }
                    }
                    return false;
                }
            })
            .followedBy("back")
            .where(new IterativeCondition<>() {
                @Override
                public boolean filter(PendingTx back, Context<PendingTx> ctx) throws Exception {
                    if (!back.isDexSwap()) {
                        return false;
                    }
                    for (PendingTx front : ctx.getEventsForPattern("front")) {
                        // Same sender as front tx, same target
                        if (front.getFrom().equalsIgnoreCase(back.getFrom()) && sameTarget(front, back)) {
                            return true;
                        }
                    }
                    return false;
                }
            })
            .within(Time.milliseconds(SANDWICH_WINDOW_MS));
    }

    /**
     * Front-run Pattern:
     * [Tx1(similar_input, gas=G1)] -> [Tx2(similar_input, gas=G2)]
     * Where G1 > G2, Tx1.from != Tx2.from
     */
    public static Pattern<PendingTx, ?> frontRunPattern() {
        return Pattern.<PendingTx>begin("frontrunner")
            .where(new SimpleCondition<>() {
                @Override
                public boolean filter(PendingTx tx) {
                    return tx.isDexSwap();
                }
            })
            .followedBy("target")
            .where(new IterativeCondition<>() {
                @Override
                public boolean filter(PendingTx target, Context<PendingTx> ctx) throws Exception {
                    if (!target.isDexSwap()) {
                        return false;
                    }
                    for (PendingTx frontrunner : ctx.getEventsForPattern("frontrunner")) {
                        // Different sender
                        if (frontrunner.getFrom().equalsIgnoreCase(target.getFrom())) {
                            continue;
                        }
                        // Same target contract
                        if (!sameTarget(frontrunner, target)) {
                            continue;
                        }
                        // Similar method
                        if (!sameMethod(frontrunner, target)) {
                            continue;
                        }
                        // Frontrunner has significantly higher gas
                        BigInteger diff = frontrunner.getEffectiveGasPrice()
                            .subtract(target.getEffectiveGasPrice());
                        if (diff.compareTo(GAS_PRICE_THRESHOLD) > 0) {
                            return true;
                        }
                    }
                    return false;
                }
            })
            .within(Time.milliseconds(FRONTRUN_WINDOW_MS));
    }

    /**
     * Abnormal Gas Pattern:
     * Transaction with gas price significantly higher than recent average
     */
    public static Pattern<PendingTx, ?> abnormalGasPattern(BigInteger threshold) {
        return Pattern.<PendingTx>begin("abnormal")
            .where(new SimpleCondition<>() {
                @Override
                public boolean filter(PendingTx tx) {
                    return tx.isDexSwap() && 
                           tx.getEffectiveGasPrice().compareTo(threshold) > 0;
                }
            });
    }

    private static boolean sameTarget(PendingTx tx1, PendingTx tx2) {
        String target1 = tx1.extractTargetToken();
        String target2 = tx2.extractTargetToken();
        return target1 != null && target1.equalsIgnoreCase(target2);
    }

    private static boolean sameMethod(PendingTx tx1, PendingTx tx2) {
        if (tx1.getMethodId() == null || tx2.getMethodId() == null) {
            return false;
        }
        return tx1.getMethodId().equalsIgnoreCase(tx2.getMethodId());
    }
}
