# Answering the rubric

`studio3 experience rubric --profile <p> --json` prints each question with its id, dimension, scale and answer
format. Answers go into `answers.json` and are merged with the measured signals.

## Evidence standards

| Question type | Acceptable evidence |
| - | - |
| Visual hierarchy, clarity of primary action | screenshot path + the element(s) you looked at |
| Copy clarity, error messages, empty states | the exact text and where it appears (route + selector or file:line) |
| Predictability (does X do what it looks like it does) | the interaction you performed and what happened |
| Motion purpose | the animation (selector or recipe id), what it communicates, and the frame screenshots |
| Spatial clarity (3D) | camera/control instructions present?, escape/reset available?, screenshot of the canvas and its fallback |

Rules:

1. Answer only what you observed. "Not observed" is a valid answer and lowers confidence honestly.
2. Score against the profile's expectations, not your taste.
3. Prefer specific over general: "the pricing toggle has no visible pressed state (states/desktop-pricing-toggle.png)"
   beats "feedback could be better".
4. If two routes differ (e.g. inconsistent navigation), cite both.
5. Never copy measured values into answers to inflate confidence — measured signals are already counted.
