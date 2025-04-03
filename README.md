# n8n-nodes-doccape

This is an n8n community node. It lets you use _Doccape_ in your n8n workflows.

_Doccape_ is an anonymization and pseudonymization solution for various file formats. It is a product of [Scitlab](https://scitlab.de/).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

- Anonymize: Anonymize or pseudonymize an input text.

## Credentials

You need an api key to use this node. You can get one by registering at [Doccape](https://api.doccape.de).

## Compatibility

This node was developed and tested using n8n version 1.81.4. It has not been tested with other versions.

## Usage

This node anonymizes or pseudonymizes an input text. You must set the `text` attribute in the node's settings to the source of the text you want to anonymize. The node will then output the anonymized text.
Additionally, with the `usePseudonyms` configuration you can set the mode to either `anonymize` or `pseudonymize`. The default mode is `pseudonymize`.
With the `textLabels` configuration you can set the types of PII that are detected. For a list of supported types, see the [Doccape Api documentation](https://api.doccape.de/api-docs).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Doccape](https://doccape.de)
