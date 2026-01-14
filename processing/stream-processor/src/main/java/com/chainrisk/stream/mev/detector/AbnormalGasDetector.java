package com.chainrisk.stream.mev.detector;

import com.chainrisk.stream.mev.model.MevAlert;
import com.chainrisk.stream.mev.model.PendingTx;
import org.apache.flink.api.common.functions.MapFunction;

import java.math.BigInteger;
import java.util.Collections;
import java.util.UUID;

/**
 * Detect abnormally high gas prices
 */
public class AbnormalGasDetector implements MapFunction<PendingTx, MevAlert> {

    private final BigInteger threshold;

    public AbnormalGasDetector(BigInteger threshold) {
        this.threshold = threshold;
    }

    @Override
    public MevAlert map(PendingTx tx) {
        MevAlert alert = new MevAlert();
        alert.setAlertId(UUID.randomUUID().toString());
        alert.setAlertType(MevAlert.AlertType.ABNORMAL_GAS);
        alert.setNetwork(tx.getNetwork());
        alert.setTimestamp(System.currentTimeMillis());
        alert.setAttackerAddress(tx.getFrom());
        alert.setFrontTxHash(tx.getHash());
        alert.setTargetContract(tx.getTo());
        alert.setRelatedTxs(Collections.singletonList(tx.getHash()));

        BigInteger gasPrice = tx.getEffectiveGasPrice();
        alert.setGasPriceDiff(gasPrice.subtract(threshold).toString());

        // Severity based on multiplier of threshold
        BigInteger twoX = threshold.multiply(BigInteger.valueOf(2));
        BigInteger threeX = threshold.multiply(BigInteger.valueOf(3));

        if (gasPrice.compareTo(threeX) > 0) {
            alert.setSeverity("critical");
        } else if (gasPrice.compareTo(twoX) > 0) {
            alert.setSeverity("high");
        } else {
            alert.setSeverity("medium");
        }

        return alert;
    }
}
