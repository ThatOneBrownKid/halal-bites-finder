interface Env {
  OPENAI_API_KEY: string;
}

interface ModerationRequest {
  reviewText?: string;
  imageBase64?: string;
  moderationType: 'review' | 'image_only' | 'avatar';
}

interface ModerationResponse {
  safe: boolean;
  reason: string;
}

const REVIEW_SYSTEM_PROMPT = `You are a content moderator for a restaurant review site.
Analyze the user's text and image for family-friendliness.

- Text Rules: Flag any profanity, hate speech, or slurs. Be strict.
- Image Rules: Flag content that is not family-friendly. This includes violence, nudity, offensive symbols, and Public Displays of Affection (PDA) like kissing. Photos of food and restaurant environments are safe.

Output only a JSON object: { "safe": boolean, "reason": "string" }.
If safe, reason is "". If unsafe, use a generic reason like "Review contains inappropriate language" or "Image is too explicit."`;

const IMAGE_ONLY_SYSTEM_PROMPT = `You are an image content moderator for a restaurant review site.
Analyze the user's image to ensure it is family-friendly.

- Rules: Flag content that is not family-friendly. This includes violence, nudity, offensive symbols, and Public Displays of Affection (PDA) like kissing.
- Safe Content: Photos of food, drinks, and restaurant environments are generally safe.

Output only a JSON object: { "safe": boolean, "reason": "string" }.
If safe, reason is "". If unsafe, use the generic reason "Image is too explicit."`;

const AVATAR_SYSTEM_PROMPT = `You are an image content moderator for user avatars.
Analyze the user's image to ensure it is family-friendly and appropriate.

- Rules: Flag nudity, violence, gore, hate symbols, or other offensive content.
- Safe Content: Normal photos of people, landscapes, or abstract images are safe.

Output only a JSON object: { "safe": boolean, "reason": "string" }.
If safe, reason is "". If unsafe, provide a brief, user-facing explanation.
Example unsafe reason: "Avatar image is inappropriate."`;

const createErrorResponse = (reason: string, status: number, corsHeaders: HeadersInit) => {
  return new Response(
    JSON.stringify({ success: false, error: { reason } }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
};

const createSuccessResponse = (data: any, corsHeaders: HeadersInit) => {
  return new Response(
    JSON.stringify({ success: true, data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  try {
    const OPENAI_API_KEY = context.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return createErrorResponse('Content moderation service is not configured. Please contact support.', 500, corsHeaders);
    }

    const { reviewText, imageBase64, moderationType = 'review' }: ModerationRequest = await context.request.json();

    if ((moderationType === 'image_only' || moderationType === 'avatar') && !imageBase64) {
      return createSuccessResponse({ safe: true, reason: '' }, corsHeaders);
    }

    if (moderationType === 'review' && (!reviewText || reviewText.trim().length === 0)) {
      return createErrorResponse('Review text is required.', 400, corsHeaders);
    }

    console.log('Moderating content:', { 
      moderationType,
      textLength: reviewText?.length || 0, 
      hasImage: !!imageBase64 
    });

    let systemPrompt: string;
    switch (moderationType) {
      case 'avatar':
        systemPrompt = AVATAR_SYSTEM_PROMPT;
        break;
      case 'image_only':
        systemPrompt = IMAGE_ONLY_SYSTEM_PROMPT;
        break;
      default:
        systemPrompt = REVIEW_SYSTEM_PROMPT;
    }

    const userContent: any[] = [];
    if (moderationType === 'review' && reviewText) {
      userContent.push({
        type: 'text',
        text: `Analyze this review for profanity and family-friendliness:\n\n"${reviewText}"`
      });
    } else {
      userContent.push({ type: 'text', text: 'Analyze this image for family-friendliness.' });
    }

    if (imageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageBase64 }
      });
    }

    console.log('Calling OpenAI for moderation...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 200,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return createErrorResponse('Content moderation is temporarily unavailable. Please try again in a moment.', 429, corsHeaders);
      }
      
      // For other upstream errors, don't block the user.
      return createSuccessResponse({ safe: true, reason: 'Moderation check failed, approved by default.' }, corsHeaders);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response:', data);
      return createSuccessResponse({ safe: true, reason: 'Moderation check failed, approved by default.' }, corsHeaders);
    }

    console.log('Moderation raw result:', content);

    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7, -3).trim();
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3, -3).trim();
    }
    
    const result: ModerationResponse = JSON.parse(jsonContent);
    console.log('Moderation parsed result:', result);

    return createSuccessResponse(result, corsHeaders);

  } catch (error) {
    console.error('Moderation error:', error);
    return createErrorResponse('Unable to verify content. Please try again.', 500, corsHeaders);
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
};
