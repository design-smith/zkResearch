pragma circom 2.0.0;

template ArrayReceived(n) {
    signal input arr[n];
    signal output out;

    out <== 1;

    // Add a dummy multiplication
    signal dummy;
    dummy <== arr[0] * 1;
}

component main = ArrayReceived(10);