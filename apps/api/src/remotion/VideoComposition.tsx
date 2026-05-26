import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoProps } from "./types";

const sceneDuration = 150;

export function AiVideo({ title, scenes, audioPath, apiBaseUrl }: VideoProps) {
  const totalDuration = Math.max(scenes.length * sceneDuration, 450);

  return (
    <AbsoluteFill style={{ backgroundColor: "#090B10", fontFamily: "Inter, Arial, sans-serif" }}>
      {audioPath ? <Audio src={`${apiBaseUrl}${audioPath}`} /> : null}
      {scenes.map((scene, index) => (
        <Sequence key={index} from={index * sceneDuration} durationInFrames={sceneDuration}>
          <SceneFrame scene={scene} title={title} index={index} total={scenes.length} apiBaseUrl={apiBaseUrl} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: 54, top: 42, color: "#E5E7EB", fontSize: 28, fontWeight: 700 }}>
          {title}
        </div>
        <div style={{ position: "absolute", right: 54, top: 46, color: "#38BDF8", fontSize: 19 }}>
          AI VIDEO GENERATOR
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function SceneFrame({
  scene,
  index,
  total,
  apiBaseUrl
}: {
  scene: VideoProps["scenes"][number];
  title: string;
  index: number;
  total: number;
  apiBaseUrl: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 20, sceneDuration - 25, sceneDuration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(enter, [0, 1], [1.08, 1]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={scene.imagePath.startsWith("/outputs") ? `${apiBaseUrl}${scene.imagePath}` : staticFile(scene.imagePath)}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }}
      />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(9,11,16,.82), rgba(11,27,58,.35), rgba(20,184,166,.12))" }} />
      <div
        style={{
          position: "absolute",
          left: 72,
          bottom: 74,
          width: 1136,
          padding: "28px 34px",
          borderRadius: 24,
          background: "rgba(17,24,39,.76)",
          border: "1px solid rgba(56,189,248,.35)",
          boxShadow: "0 26px 80px rgba(2,6,23,.55)"
        }}
      >
        <div style={{ color: "#38BDF8", fontSize: 20, marginBottom: 12 }}>
          Sahne {index + 1} / {total}
        </div>
        <div style={{ color: "#E5E7EB", fontSize: 34, lineHeight: 1.28, fontWeight: 650 }}>{scene.subtitle || scene.text}</div>
      </div>
    </AbsoluteFill>
  );
}
