---
#https://www.notion.so/n8n/Frontmatter-432c2b8dff1f43d4b1c8d20075510fe4
title: ONLYOFFICE credentials
description: Documentation for ONLYOFFICE credentials. Use these credentials to authenticate ONLYOFFICE in n8n, a workflow automation platform.
contentType: [integration, reference]
---

# ONLYOFFICE credentials

You can use these credentials to authenticate the following nodes:

- [ONLYOFFICE DocSpace](/integrations/builtin/app-nodes/n8n-nodes-base.onlyoffice/index.md)
- [ONLYOFFICE DocSpace Trigger](/integrations/builtin/trigger-nodes/n8n-nodes-base.onlyofficetrigger.md)

## Prerequisites

Create a new [ONLYOFFICE DocSpace](https://www.onlyoffice.com/docspace-registration.aspx){:target=_blank .external-link} portal or get an invitation to an existing one.

## Supported authentication methods

- API Key
- Basic Auth
- OAuth2
- Personal Access Token

## Using API Key

To configure this credential, you'll need:

- A **Base URL** of your ONLYOFFICE DocSpace portal.
- An **API Key** generated in your ONLYOFFICE DocSpace portal.

### Generate API Key in ONLYOFFICE DocSpace

1. In your ONLYOFFICE DocSpace portal, navigate to the **Developer Tools** section.
2. Open the **API Keys** tab.
3. Click the **Create new secret key** button.
4. Enter a **Name** for your API key (for example, n8n integration).
5. Click the **Generate** button.
6. Copy the generated API key.

### Configure n8n Credentials

7. In your n8n instance, navigate to the credentials form.
8. Enter the **Base URL** of your ONLYOFFICE DocSpace portal (for example, `https://yourportal.onlyoffice.com`).
9. Paste the copied API key into the **API Key** field.
10. Click the **Save** button to save your credentials.

### Related Resources

Refer to [ONLYOFFICE DocSpace Help Center: API Keys](https://helpcenter.onlyoffice.com/docspace/configuration/docspace-developer-tools-settings.aspx#apikeys_block){:target=_blank .external-link} and [ONLYOFFICE DocSpace API: API Keys](https://api.onlyoffice.com/docspace/api-backend/get-started/authentication/api-keys/){:target=_blank .external-link} for more information.

## Using Basic Auth

To configure this credential, you'll need:

- A **Base URL** of your ONLYOFFICE DocSpace portal.
- An **Email** associated with your ONLYOFFICE DocSpace account.
- A **Password** associated with your ONLYOFFICE DocSpace account.

### Configure n8n Credentials

1. In your n8n instance, navigate to the credentials form.
2. Enter the **Base URL** of your ONLYOFFICE DocSpace portal (for example, `https://yourportal.onlyoffice.com`).
3. Enter the **Email** associated with your ONLYOFFICE DocSpace account.
4. Enter the **Password** associated with your ONLYOFFICE DocSpace account.
5. Click the **Save** button to save your credentials.

### Related Resources

Refer to [ONLYOFFICE DocSpace API: Basic Authentication](https://api.onlyoffice.com/docspace/api-backend/get-started/authentication/basic-authentication/){:target=_blank .external-link} for more information.

## Using OAuth2

To configure this credential, you'll need:

- A **Base URL** of your ONLYOFFICE DocSpace portal.
- A **Client ID** of the application registered in your ONLYOFFICE DocSpace portal.
- A **Client Secret** associated with the application registered in your ONLYOFFICE DocSpace portal.

### Prepare Workspace

1. Open your ONLYOFFICE DocSpace portal in one browser tab.
2. Open your n8n instance in another browser tab.
3. In your n8n instance, navigate to the credentials form.
4. Copy the **OAuth Redirect URL** and keep it handy for step 11.

### Register OAuth Application in ONLYOFFICE DocSpace

5. In your ONLYOFFICE DocSpace portal, navigate to the **Developer Tools** section.
6. Open the **OAuth 2.0** tab.
7. Click the **Register a new application** button.
8. Enter an **App name** for your application (for example, n8n integration).
9. Enter a **Website URL** for your application (for example, `https://n8n.io` for the official n8n cloud, or your own n8n instance URL).
10. Upload an **App icon** for your application (for example, the n8n official logo from the [n8n Press pack](https://drive.google.com/drive/folders/1kz359pqtiw5-hoNGgaXQ-VzLCyKW_Qi1?usp=sharing){:target=_blank .external-link}).
11. Past the OAuth Redirect URL you copied in step 4 into the **Redirect URL** field.
12. Enter the **Allowed origin** URL (same as your Website URL from step 9).
13. Enter a **Privacy policy URL** (for example, `https://n8n.io/legal/#privacy`).
14. Enter a **Terms of Service URL** (for example, `https://n8n.io/legal/#terms`).
15. Click the **Save** button to create your application.

### Configure n8n Credentials

16. Open the newly created application in the **OAuth 2.0** tab.
17. Copy the **Client ID** from your ONLYOFFICE DocSpace application.
18. In your n8n instance, navigate to the credentials form and paste the Client ID into the **Client ID** field.
19. Back in your ONLYOFFICE DocSpace portal, copy the **Client Secret** from your application.
20. In your n8n instance, paste the Client Secret into the **Client Secret** field.
21. Enter the **Base URL** of your ONLYOFFICE DocSpace portal (for example, `https://yourportal.onlyoffice.com`).
22. Click the **Save** button to save your credentials.

### Related Resources

Refer to [ONLYOFFICE DocSpace Help Center: OAuth 2.0](https://helpcenter.onlyoffice.com/docspace/configuration/docspace-developer-tools-settings.aspx#oauth_block){:target=_blank .external-link} and [ONLYOFFICE DocSpace API: OAuth 2.0](https://api.onlyoffice.com/docspace/api-backend/get-started/authentication/oauth2/){:target=_blank .external-link} for more information.

## Using Personal Access Token

To configure this credential, you'll need:

- A **Base URL** of your ONLYOFFICE DocSpace portal.
- A **Personal Access Token** generated in your ONLYOFFICE DocSpace portal.

This authentication method is not recommended for general use. Personal Access Tokens can only be created using the ONLYOFFICE DocSpace API or retrieved from browser session cookies generated by the portal. This method should only be used for debugging purposes.

### Related Resources

Refer to [ONLYOFFICE DocSpace API: Personal Access Tokens](https://api.onlyoffice.com/docspace/api-backend/get-started/authentication/personal-access-tokens/){:target=_blank .external-link} for more information.
