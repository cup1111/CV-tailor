# Review Verdict FAIL is advisory, not a gate

Status: accepted

Review outputs PASS or FAIL as a quality judgment on application materials. We decided FAIL must not block the workflow: when Role Title and Employer Name are parseable from review output, the review step is completed, identity is minted, the Application Pack is complete, and Resume Export / Archive / batch completion proceed as normal. FAIL is stored as an advisory flag (`reviewVerdict: 'fail'` only; cleared on PASS) and surfaced as a small secondary badge on the Job card; full review text stays in results. Step `failed` is reserved for review that did not finish or produced unparseable mint fields. Job View read reconciles older jobs that were marked failed under the previous gate semantics. CLI and batch flows do not warn or fail on advisory FAIL.

**Rejected:** keeping FAIL as step failed and blocking Export; minting only on PASS; showing FAIL only as the primary status badge.
