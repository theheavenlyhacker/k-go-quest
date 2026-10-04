# Python ML boundary

`src/modules/learning/mastery.ts` contains a BKT prototype. The initial probability is 0.2; guessing is 0.2, slipping 0.1, and learning 0.08. Parameters are manually selected, not fitted to real learners.

The future Python pipeline can fit and evaluate parameters using authorized first-attempt data. Split learners between training and evaluation sets, and prevent future-attempt leakage. Do not use Khan Academy content or records without the necessary authorization.

Proposed artifact:

```json
{
  "version": "bkt-trained-v1",
  "skillCode": "demo.math5.fractions.add",
  "initial": 0.2,
  "guess": 0.2,
  "slip": 0.1,
  "learn": 0.08
}
```

Validate parameters, version the artifact, and evaluate performance before deployment. Expo can apply the same equations to provisional offline estimates. NestJS reconciles accepted attempts and controls official rewards. Python inference must not be required for offline lessons.

A trained model, artifact upload API, speech recognition, OCR, and language-model inference are not implemented in this backend.
