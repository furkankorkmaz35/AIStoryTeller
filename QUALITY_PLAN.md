# AIStoryTeller Output Quality Plan

## Goal

AIStoryTeller should not only finish a render. It should produce a video whose visuals are related to the prompt, whose style stays consistent across scenes, whose narration is clean, and whose fallback output still looks intentional enough for a course demo.

## Quality Principles

- The product has two creation modes:
  - `Full Auto`: the system automatically generates story, scene prompts, visuals, narration, subtitles, Remotion render, and export.
  - `Studio Import`: the system generates story and detailed scene prompts, then waits for manually imported scene clips/images or a complete final video, and continues the final automation after import.
- Scene relevance comes before provider preference. A stock image is not acceptable just because it downloads successfully.
- The default mode should prefer AI image providers and premium Remotion fallback; stock is used only when the user explicitly chooses stock-assisted mode.
- Every scene should carry a visual bible: same format, color grade, camera language, realism level, and subject direction.
- Voiceover text must be cleaned before TTS. Labels such as "Sahne 1", "Hook:", hashtags, markdown blocks, and long noisy captions must not be sent to narration.
- Fallback scenes must look designed, not like placeholders.
- Provider decisions must be visible in logs and UI so weak output can be diagnosed quickly.

## Implementation Plan

1. Story and scene structure
   - Force Groq/Gemini to return plain string scenes.
   - Normalize object-shaped scene responses into clean strings.
   - Keep subtitles short and remove artificial labels.

2. Visual consistency
   - Generate a project-level visual profile.
   - Strengthen every image prompt with a scene subject lock.
   - Prevent direct stock usage unless material mode is stock-assisted.
   - Add a quality score and reason to every generated material.

3. Provider strategy
   - Default order: Cloudflare, Hugging Face, Pollinations, premium fallback.
   - AI image mode never uses stock.
   - Stock-assisted mode may use Pexels/Pixabay first, then cloud providers.
   - Fallback remains render-safe and prompt-aware.

4. Voice quality
   - Keep ElevenLabs as the default voice provider.
   - Clean narration text before sending it to TTS.
   - Split long text into chunks and concatenate audio.
   - Log which voice/provider actually worked.

5. UI/UX
   - Remove misleading child-story defaults.
   - Show provider result, material type, and quality score per scene.
   - Keep controls simple: quality mode, material mode, image provider, subtitles, language, voice.
   - Keep regenerate-scene action visible for weak scenes.

6. Remotion
   - Use Ken Burns motion, controlled overlays, subtitle-safe areas, and restrained progress indicators.
   - Remove placeholder service labels from fallback scenes.
   - Keep text large enough for mobile shorts but not overly bulky.

7. API-free premium clip mode
   - Do not automate third-party web UIs with browser bots.
   - Generate scene prompts and let the user manually create clips with any free web allowance they already have.
   - Allow each scene to import an external MP4/WebM/MOV clip.
   - Use imported clips directly in Remotion while keeping the project narration, subtitles, captions, and export pipeline.
   - Store imported clips as `external-video` scene material with provider and quality metadata.

8. Verification
   - Typecheck and production build must pass.
   - Docker web, API, and worker must run.
   - Browser UI should show updated defaults, no direct stock provider button, visible subtitles option, and scene-level quality metadata.
