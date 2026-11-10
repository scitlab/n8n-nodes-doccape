# n8n Workflow: HR Application Comparison (pseudonymized)

An HR team wants to compare several PDF applications against one job description and get a ranked shortlist. The language model must not see names, emails, or addresses.

[doccape](https://app.doccape.de/) replaces that personal data with pseudonyms before the comparison. The model explains each rank using those pseudonyms. A later step puts the real names back into the explanations, and the form shows an HTML table for a person to review. The workflow only supports the decision; a human stays responsible.

## What it does

1. Form trigger: job description + multiple application PDFs.
2. Extract text from each PDF and combine into one batch.
3. **Anonymize Text** with doccape; keep the returned `detection.detections` mapping in a trusted branch.
4. AI agent compares pseudonymized applications against the job description.
5. Code nodes put the real names back into those reasons and build the HTML result.

## Requirements

- [n8n](https://n8n.io/) with the doccape community node installed
- **Doccape API** credentials
- **OpenAI** credentials (or replace the chat model node with another provider)

> Register at [https://app.doccape.de](https://app.doccape.de) for an API key.

## How to use

1. Import `workflow.json` into n8n.
2. Attach **Doccape API** to **Anonymize Concatenated Text** and enable pseudonyms.
3. Attach **OpenAI** to **OpenAI Chat Model** (or swap the model).
4. Activate the workflow and open the form test URL on **Application Form**.
5. Submit a job description and PDF applications; review the HTML ranking table.

## Flow

```
Form → Split PDFs → Extract → Concatenate → Anonymize Text → Prepare → AI Agent → De-anonymize → HTML
                                                                              ↑
                                                                      OpenAI + Output Parser
```

## Security note

Do **not** pass `detection.detections` into LLM or agent prompts. Use the mapping only in trusted n8n steps (as in **Prepare Ranking**).

---

© scitlab
