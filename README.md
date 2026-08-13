<p align="center">
  <a href="https://github.com/scitlab/n8n-nodes-doccape">
    <img loading="lazy" alt="doccape" src="./doccape_hero.png" width="30%"/>
  </a>
</p>

<h1 align="center">
  <br>
  n8n-nodes-doccape
  <br>
</h1>

<p align="center">
  <a href="#installation">Installation</a> |
  <a href="#operations">Operations</a> |
  <a href="#credentials">Credentials</a> |
  <a href="#compatibility">Compatibility</a> |
  <a href="#usage">Usage</a> |
  <a href="#resources">Resources</a>
</p>

---

This is an n8n community node for integrating _doccape_ into your n8n workflows. _doccape_ is an **anonymization** solution for text and various file formats. It is a product of [scitlab](https://scitlab.de/).

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

The node exposes two resources: **Text** and **File**:

- **Anonymize Text** — Send text to doccape and receive the anonymized result.

- **Anonymize File** — Upload a binary file, poll doccape until processing finishes, and return the anonymized file as binary data. Optionally deletes the document from doccape afterwards.

## Credentials

You need a doccape account and an API key. Register at [doccape](https://app.doccape.de) to obtain one. See our [getting started guide](https://docs.doccape.de/docs/) for more details.

Create a **Doccape API** credential in n8n with:

- **API Base URL** — The base URL of your doccape instance (defaults to `https://app.doccape.de`).
- **API Key** — Your doccape API key. It is sent as a `Bearer` token. For more information about API keys, see the [doccape documentation](https://docs.doccape.de/docs/api-keys).

## Compatibility

Requires n8n `n8nNodesApiVersion` 1. Developed and tested against n8n 2.31.4; older or more recent versions are expected to work but have not been explicitly tested.

## Usage

### Anonymizing text

Set the **Text** field to the text you want to process. Enable **Use Pseudonyms** to replace PII with labels like `PER-1` or `LOC-1`, or disable it for a generic placeholder (`****`). Use **PII Classes to Detect** to control which categories are detected (comma-separated, e.g. `PER,STR,LOC,ORG`).

### Anonymizing files

For files you can configure both **text** and **image** anonymization:

- **Text PII Classes to Detect** — Comma-separated PII categories (e.g. `PER,STR,LOC,ORG`).
- **Use Pseudonyms** — Replace PII with labels like `PER-1` or `LOC-1`, or disable for a generic placeholder (`****`).
- **Image PII Classes to Detect** — Comma-separated categories (e.g. `text,face,licence_plate,qr_code`).
- **Image Anonymization Type** — Mask, Blur, or Pixelate.

Use **Anonymize File** for a one-step flow that uploads, waits for processing, and returns the finished file. Adjust **Polling Interval** and **Polling Timeout** to control how long the node waits, and **Delete Document After Anonymization** to control cleanup.

Enable **Include Detected PIIs** to attach detections on `$json.piis`. That payload often contains original values — do not pass it into LLM or agent prompts; use it for audit or post-response re-identification instead.

The supported PII labels can be retrieved via the doccape API:

- Text labels: `GET /external/v1/text-labels`
- Image labels: `GET /external/v1/image-labels`

See the [doccape API documentation](https://docs.doccape.de/docs/category/api) for details.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [doccape](https://doccape.de)
- [doccape API documentation](https://docs.doccape.de/docs/category/api)
- [doccape documentation](https://docs.doccape.de/docs/)
