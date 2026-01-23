import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModerationRequest {
  reviewText: string;
  imageBase64?: string; // base64 encoded image with data URI prefix
}

interface ModerationResponse {
  safe: boolean;
  reason: string;
}

const SYSTEM_PROMPT = `You are an AI content moderator for a Halal restaurant review website. Your job is to analyze user-submitted text reviews and accompanying images to ensure they are appropriate.

Your Rules:

Text Analysis: Scan the review text for profanity, hate speech, or highly offensive language.

Image Analysis: Scan the image specifically for alcoholic beverages (beer bottles, wine glasses filled with colored liquid, liquor bottles, bar taps).

Contextual Nuance (Crucial): You must use the text to interpret the image. If the image shows a drink that looks like a cocktail, but the review explicitly mentions it is a "mocktail," "virgin drink," or "non-alcoholic," you must mark it as SAFE. Only flag it if it clearly appears to be alcohol and the text does not offer a halal explanation.

Output Format: You must return a strict JSON object in this format: { "safe": boolean, "reason": "string (short explanation for the user if unsafe)" }

If the content is safe, return: { "safe": true, "reason": "" }`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ safe: false, reason: 'Content moderation service is not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { reviewText, imageBase64 }: ModerationRequest = await req.json();

    if (!reviewText || reviewText.trim().length === 0) {
      return new Response(
        JSON.stringify({ safe: false, reason: 'Review text is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Moderating review:', { 
      textLength: reviewText.length, 
      hasImage: !!imageBase64 
    });

    // Build the message content
    const userContent: any[] = [
      {
        type: 'text',
        text: `Please analyze this restaurant review for appropriateness:\n\n"${reviewText}"`
      }
    ];

    // Add image if provided
    if (imageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageBase64,
          detail: 'low' // Use low detail for faster processing
        }
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        max_tokens: 150,
        temperature: 0.1, // Low temperature for consistent moderation
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      // Don't block submission if moderation fails - log and allow through
      return new Response(
        JSON.stringify({ safe: true, reason: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in OpenAI response:', data);
      return new Response(
        JSON.stringify({ safe: true, reason: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Moderation result:', content);

    const result: ModerationResponse = JSON.parse(content);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Moderation error:', error);
    
    // On error, allow submission to proceed (fail open)
    return new Response(
      JSON.stringify({ safe: true, reason: '' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
