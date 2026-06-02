import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoProps } from "./types";

const fallbackSceneDuration = 132;

export function AiVideo({ title, scenes, audioPath, apiBaseUrl, subtitlesEnabled = true, sceneDurationInFrames = fallbackSceneDuration }: VideoProps) {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleFade = interpolate(frame, [0, 24, 78, 108], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#20242d", fontFamily: "Inter, Arial, sans-serif" }}>
      {audioPath ? <Audio src={`${apiBaseUrl}${audioPath}`} /> : null}
      {scenes.map((scene, index) => (
        <Sequence key={index} from={index * sceneDurationInFrames} durationInFrames={sceneDurationInFrames}>
          <SceneFrame scene={scene} index={index} apiBaseUrl={apiBaseUrl} subtitlesEnabled={subtitlesEnabled} sceneDuration={sceneDurationInFrames} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: 48,
            top: 40,
            right: 160,
            color: "#F8FAFC",
            opacity: intro * titleFade * 0.92,
            fontSize: 24,
            fontWeight: 850,
            lineHeight: 1.16,
            textShadow: "0 18px 42px rgba(2,6,23,.72)"
          }}
        >
          {title}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function SceneFrame({
  scene,
  index,
  apiBaseUrl,
  subtitlesEnabled,
  sceneDuration
}: {
  scene: VideoProps["scenes"][number];
  index: number;
  apiBaseUrl: string;
  subtitlesEnabled: boolean;
  sceneDuration: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 92, mass: 0.95 } });
  const opacity = interpolate(frame, [0, 14, sceneDuration - 18, sceneDuration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const direction = index % 4;
  const scale = interpolate(frame, [0, sceneDuration], direction % 2 === 0 ? [1.05, 1.15] : [1.15, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const panX = interpolate(frame, [0, sceneDuration], direction === 0 ? [-24, 22] : direction === 1 ? [20, -20] : direction === 2 ? [-8, 12] : [12, -8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const panY = interpolate(frame, [0, sceneDuration], direction === 2 ? [-18, 18] : direction === 3 ? [16, -18] : [-6, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const captionY = interpolate(enter, [0, 1], [22, 0]);
  const captionOpacity = interpolate(frame, [8, 22, sceneDuration - 24, sceneDuration - 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sweep = interpolate(frame, [12, sceneDuration - 18], [-40, 112], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progressWidth = interpolate(frame, [0, sceneDuration], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const captionText = scene.subtitle || scene.text;
  const captionLines = splitCaption(captionText);
  const fontSize = captionText.length > 66 ? 30 : 34;
  const lineHeight = captionText.length > 66 ? 1.16 : 1.12;
  const subtitleBottom = index % 3 === 1 ? 128 : 92;

  return (
    <AbsoluteFill style={{ opacity }}>
      {scene.videoPath ? (
        <OffthreadVideo
          src={scene.videoPath.startsWith("/outputs") ? `${apiBaseUrl}${scene.videoPath}` : staticFile(scene.videoPath)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(1.03) translate3d(${panX * 0.35}px, ${panY * 0.35}px, 0)` }}
        />
      ) : (
        <Img
          src={scene.imagePath.startsWith("/outputs") ? `${apiBaseUrl}${scene.imagePath}` : staticFile(scene.imagePath)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translate3d(${panX}px, ${panY}px, 0)` }}
        />
      )}
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 48%, transparent 35%, rgba(2,6,23,.22) 72%, rgba(2,6,23,.58) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(18,22,29,.5) 0%, rgba(32,36,45,.05) 43%, rgba(15,23,42,.72) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(148,163,184,.1), transparent 38%, rgba(14,165,233,.09))" }} />
      <AbsoluteFill style={{ opacity: 0.12, backgroundImage: "radial-gradient(rgba(255,255,255,.26) 1px, transparent 1px)", backgroundSize: "6px 6px", mixBlendMode: "overlay" }} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(105deg, transparent ${sweep - 10}%, rgba(255,255,255,.16) ${sweep}%, transparent ${sweep + 10}%)`,
          mixBlendMode: "screen"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 48,
          right: 48,
          bottom: 54,
          height: 3,
          overflow: "hidden",
          borderRadius: 999,
          background: "rgba(226,232,240,.16)"
        }}
      >
        <div
          style={{
            width: `${progressWidth}%`,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #CBD5E1, #38BDF8, #2DD4BF)",
            boxShadow: "0 0 22px rgba(125,211,252,.34)"
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: -150 + panX,
          top: 220,
          width: 380,
          height: 380,
          borderRadius: 999,
          background: "rgba(148,163,184,.11)",
          filter: "blur(56px)"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -110 - panX,
          bottom: 250,
          width: 330,
          height: 330,
          borderRadius: 999,
          background: "rgba(37,99,235,.12)",
          filter: "blur(52px)"
        }}
      />
      {subtitlesEnabled ? (
        <div
          style={{
            position: "absolute",
            left: 58,
            right: 58,
            bottom: subtitleBottom,
            padding: "17px 21px 18px",
            borderRadius: 16,
            opacity: captionOpacity,
            transform: `translateY(${captionY}px)`,
            background: "linear-gradient(135deg, rgba(15,18,25,.62), rgba(30,41,59,.42))",
            border: "1px solid rgba(226,232,240,.13)",
            boxShadow: "0 22px 58px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.06)",
            backdropFilter: "blur(14px)"
          }}
        >
          <div style={{ color: "#F8FAFC", fontSize, lineHeight, fontWeight: 900, textShadow: "0 12px 34px rgba(2,6,23,.42)" }}>
            {captionLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function splitCaption(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= 34) return [text];
  const midpoint = Math.floor(text.length / 2);
  const before = text.lastIndexOf(" ", midpoint);
  const after = text.indexOf(" ", midpoint);
  const breakPoint = before > 18 ? before : after > 0 ? after : midpoint;
  return [text.slice(0, breakPoint).trim(), text.slice(breakPoint).trim()].filter(Boolean);
}
