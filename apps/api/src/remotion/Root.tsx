import React from "react";
import { Composition } from "remotion";
import { AiVideo } from "./VideoComposition";
import type { VideoProps } from "./types";

const defaultProps: VideoProps = {
  title: "AI Video Generator",
  story: "",
  audioPath: "",
  apiBaseUrl: "http://localhost:4000",
  scenes: [
    {
      text: "Demo sahnesi",
      subtitle: "Demo sahnesi",
      imagePath: "",
      }
  ]
};

export function RemotionRoot() {
  return (
    <Composition
      id="AiVideo"
      component={AiVideo}
      durationInFrames={450}
      fps={30}
      width={1280}
      height={720}
      defaultProps={defaultProps}
    />
  );
}
