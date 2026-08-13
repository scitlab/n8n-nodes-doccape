# n8n Workflow: Doccape File Anonymization

This example demonstrates how to anonymize a file using the [doccape](https://app.doccape.de/) **Anonymize File** operation.

## What It Does

1. Accepts a file upload via a web form.
2. Sends the file to doccape with **Anonymize File** — the node uploads the binary, polls until processing finishes, and returns the anonymized file plus detected PIIs on `$json.piis`.
3. Saves the result to disk.

## Requirements

- [n8n](https://n8n.io/) with the doccape community node package installed
- A valid **Doccape API** credential

> To obtain an API key, visit [https://app.doccape.de](https://app.doccape.de)

## How to Use

1. Import `workflow.json` into your n8n instance.
2. Attach your **Doccape API** credential to **Anonymize File**.
3. Adjust the output path in **Save anonymized file** if needed (default: `/home/node/`).
4. Trigger the workflow by uploading a file through the form.

## Flow

```
On form submission → Anonymize File → Save anonymized file
```

## Output

The **Anonymize File** node returns:

- Binary data in the `data` field (the anonymized file)
- JSON metadata: `status`, `deleted` when cleanup is enabled, and `piis` when **Include Detected PIIs** is on

`$json.piis` often contains original values — do not pass it into LLM or agent prompts.

---

© scitlab
