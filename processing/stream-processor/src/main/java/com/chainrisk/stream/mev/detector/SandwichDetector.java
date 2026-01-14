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
 * Process matched sandwich attack patterns
 */
public class SandwichDetector extends PatternProcessFunction<PendingTx, MevAlert> {

    @Override
    public void processMatch(Map<String, List<PendingTx>> match, Context ctx, Collector<MevAlert> out) {
        List<PendingTx> frontList = match.get("front");
        List<PendingTx> victimList = match.get("victim");
        List<PendingTx> backList = match.get("back");

        if (frontList == null || victimList == null || backList == null) {
            return;
        }

        PendingTx front = frontList.get(0);
        PendingTx victim = victimList.get(0);
        PendingTx back = backList.get(0);

        MevAlert alert = new MevAlert();
        alert.setAlertId(UUID.randomUUID().toString());
        alert.setAlertType(MevAlert.AlertType.SANDWICH_ATTACK);
        alert.setNetwork(front.getNetwork());
        alert.setTimestamp(System.currentTimeMillis());
        alert.setAttackerAddress(front.getFrom());
        alert.setVictimAddress(victim.getFrom());
        alert.setVictimTxHash(victim.getHash());
        alert.setFrontTxHash(front.getHash());
        alert.setBackTxHash(back.getHash());
        alert.setTargetContract(front.extractTargetToken());
        alert.setRelatedTxs(Arrays.asList(front.getHash(), victim.getHash(), back.getHash()));

        // Calculate gas price difference
        BigInteger frontGas = front.getEffectiveGasPrice();
        BigInteger victimGas = victim.getEffectiveGasPrice();
        alert.setGasPriceDiff(frontGas.subtract(victimGas).toString());

        // Severity based on gas diff
        BigInteger diff = frontGas.subtract(victimGas);
        if (diff.compareTo(new BigInteger("50000000000")) > 0) { // >50 Gwei
            alert.setSeverity("critical");
        } else if (diff.compareTo(new BigInteger("20000000000")) > 0) { // >20 Gwei
            alert.setSeverity("high");
        } else {
            alert.setSeverity("medium");
        }

        out.collect(alert);
    }
}
