const DEFAULT_API_URL = 'https://specway.com/api/cli';

interface PublishResult {
  success: true;
  url: string;
  slug: string;
}

interface PublishError {
  success: false;
  error: string;
}

export async function publishSpec(
  specContent: string,
  apiKey: string,
  apiUrl?: string
): Promise<PublishResult | PublishError> {
  const baseUrl = apiUrl || process.env.SPECWAY_API_URL || DEFAULT_API_URL;

  try {
    const response = await fetch(`${baseUrl}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ spec: specContent }),
    });

    if (!response.ok) {
      const body = await response.text();
      let message: string;
      try {
        message = JSON.parse(body).error || body;
      } catch {
        message = body;
      }
      return { success: false, error: `HTTP ${response.status}: ${message}` };
    }

    const data = await response.json();
    return { success: true, url: data.url, slug: data.slug };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
