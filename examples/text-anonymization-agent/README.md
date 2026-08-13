# n8n Workflow: Doccape Text Anonymization for Agents

This example shows how to anonymize chat input with [doccape](https://app.doccape.de/) before sending it to an AI agent.

## What It Does

1. Receives a chat message.
2. Anonymizes the message with the doccape **Anonymize Text** operation.
3. Passes only the anonymized text (`pseudonymizedText`) to an AI agent.

That way PII never reaches the language model.

## Requirements

- [n8n](https://n8n.io/) with the doccape community node package installed
- A valid **Doccape API** credential
- An **OpenAI** credential (or swap the chat model node for another provider)

> To obtain a doccape API key, visit [https://app.doccape.de](https://app.doccape.de)

## How to Use

1. Import `workflow.json` into your n8n instance.
2. Attach your **Doccape API** credential to **Anonymize Text**.
3. Attach your **OpenAI** credential to **OpenAI Chat Model** (or replace that node).
4. Open the chat trigger and send a message that contains personal data, for example:

   `Please summarize: Max Mustermann lives in Berlin and can be reached at max@example.com.`

5. Confirm that the agent only sees anonymized text such as `PER-1`, `LOC-1`, `MAIL-1`.

## Flow

```
When chat message received → Anonymize Text → AI Agent
                                              ↑
                                   OpenAI Chat Model
```

## Output

The **AI Agent** node returns the agent response based on the anonymized input. The **Anonymize Text** node output includes `pseudonymizedText` and `detection.detections` if you need them in downstream steps.

---

© scitlab
