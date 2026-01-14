package com.chainrisk.stream.mev.detector;

import com.chainrisk.stream.mev.model.MevAlert;
import com.chainrisk.stream.mev.model.PendingTx;
import org.apache.flink.cep.functions.PatternProcessFunction;
import org.apache.flink.util.Collector;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Process matched front-run patterns
 */
public class FrontRunDetector extends PatternProcessFunction<PendingTx, MevAlert> {

    @Override
    public void processMatch(Map<String, List<PendingTx>> match, Context ctx, Collector<MevAlert> out) {
        List<PendingTx> frontrunnerList = match.get("frontrunner");
        List<PendingTx> targetList = match.get("target");

        if (frontrunnerList == null || targetList == null) {
            return;
        }

        PendingTx frontrunner = frontrunnerList.get(0);
        PendingTx target = targetList.get(0);

        MevAlert alert = new MevAlert();
        alert.setAlertId(UUID.randomUUID().toString());
        alert.setAlertType(MevAlert.AlertType.FRONT_RUN);
        alert.setNetwork(frontrunner.getNetwork());
        alert.setTimestamp(System.currentTimeMillis());
        alert.setAttackerAddress(frontrunner.getFrom());
        alert.setVictimAddress(target.getFrom());
        alert.setVictimTxHash(target.getHash());
        alert.setFrontTxHash(frontrunner.getHash());
        alert.setTargetContract(frontrunner.extractTargetToken());
        alert.setRelatedTxs(Arrays.asList(frontrunner.getHash(), target.getHash()));

        BigInteger diff = frontrunner.getEffectiveGasPrice().subtract(target.getEffectiveGasPrice());
        alert.setGasPriceDiff(diff.toString());

        // Severity
        if (diff.compareTo(new BigInteger("100000000000")) > 0) { // >100 Gwei
            alert.setSeverity("critical");
        } else if (diff.compareTo(new BigInteger("50000000000")) > 0) { // >50 Gwei
            alert.setSeverity("high");
        } else {
            alert.setSeverity("medium");
        }

        out.collect(alert);
    }
}
