# Gemini API Integration

The HomeLab platform integrates with the Google Gemini API to provide LLM capabilities. This document outlines how to set up your environment to use these features.

## Prerequisites

To use the Gemini integration, you need an API key from Google AI Studio. 

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. In the left navigation pane, click on **Get API key**.
4. Click the **Create API key in new project** button. Alternatively, if you already have a Google Cloud project linked, you can select it.
5. Copy the generated API key. Keep this secure; do not commit it to version control.

## Configuration

Once you have your API key, you need to configure your local environment:

1. Open the `.env` file at the root of the project.
2. Locate the `# Gemini API` section.
3. Add your key to the `GEMINI_API_KEY` variable:

```env
# Gemini API
# Get your API key from Google AI Studio: https://aistudio.google.com/
GEMINI_API_KEY=AIzaSyYourGeneratedKeyHere...
```

4. Restart your node server (if it's not using `nodemon` or if it's not picking up `.env` changes automatically). 

## Implementation Details

The underlying integration is handled by the `GeminiGateway` class located at `server/src/core/gateways/gemini-gateway.ts`. 

### Basic Usage

The gateway exposes a simple `generateText(prompt: string)` method designed for basic command-response interactions. It uses the REST API directly to avoid reliance on heavy SDKs.

```typescript
import { GeminiGateway } from './../core/gateways/gemini-gateway';

// Initialize from environment config
const gemini = GeminiGateway.fromEnvironment();

// Generate text
const responseText = await gemini.generateText('What is the weather usually like in May?');
console.log(responseText);
```

### Models
Currently, the integration defaults to `gemini-1.5-flash`, which is optimized for speed and cost-effectiveness. The model parameter is configurable if you wish to use a different model (like `gemini-1.5-pro`):

```typescript
await gemini.generateText(prompt, 'gemini-1.5-pro');
```

## Future Enhancements
* **Chat / Streaming:** The current client handles single-turn prompt operations, returning a static string. It can be extended to support `streamGenerateContent` for real-time typing responses in the UI.
* **System Instructions:** Adding system prompts or structured JSON output features as needed for deeper integration.
