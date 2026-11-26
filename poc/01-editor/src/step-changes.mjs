// Pure ProseMirror Mapping adapter. Only replacement steps produce text deltas.
// A Step's old coordinates refer to the doc immediately BEFORE that Step,
// not to oldState.doc. Inverting every preceding mapping is essential when
// a single transaction has multiple replacements or appendTransaction sees
// multiple transactions. The resulting old range always refers to oldState.
export function collectTextChanges(transactions) {
  const changes = [];
  for (let ti = 0; ti < transactions.length; ti++) {
    const tr = transactions[ti];
    if (!tr.docChanged || tr.getMeta('mochop:mark-applied') || tr.getMeta('history$')) continue;
    for (let si = 0; si < tr.steps.length; si++) {
      const step = tr.steps[si];
      if (!('slice' in step) && !('insert' in step)) continue;
      step.getMap().forEach((stepOldFrom, stepOldTo, stepNewFrom, stepNewTo) => {
        if (stepOldFrom === stepOldTo && stepNewFrom === stepNewTo) return;
        // Map the current step's new range forward to the final document.
        const after = tr.mapping.slice(si + 1);
        let from = after.map(stepNewFrom, -1);
        let to = after.map(stepNewTo, 1);
        for (let j = ti + 1; j < transactions.length; j++) {
          from = transactions[j].mapping.map(from, -1);
          to = transactions[j].mapping.map(to, 1);
        }
        // Map the current step's old range BACK to the input document.
        const before = tr.mapping.slice(0, si).invert();
        let oldFrom = before.map(stepOldFrom, -1);
        let oldTo = before.map(stepOldTo, 1);
        for (let j = ti - 1; j >= 0; j--) {
          const inverse = transactions[j].mapping.invert();
          oldFrom = inverse.map(oldFrom, -1);
          oldTo = inverse.map(oldTo, 1);
        }
        changes.push({ from: Math.min(from, to), to: Math.max(from, to),
          oldFrom: Math.min(oldFrom, oldTo), oldTo: Math.max(oldFrom, oldTo),
          inputType: tr.getMeta('uiEvent'), tr, transactionIndex: ti, stepIndex: si });
      });
    }
  }
  return changes;
}
