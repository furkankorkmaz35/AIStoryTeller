import React from "react";
import { Composition } from "remotion";
import { AiVideo } from "./VideoComposition";
import type { VideoProps } from "./types";

const defaultProps: VideoProps = {
  title: "AI Video Generator",
  story: "",
  audioPath: "",
  apiBaseUrl: "http://localhost:4000",
  aspectRatio: "9:16",
  language: "tr",
  sceneDurationInFrames: 132,
  scenes: [
    {
      text: "Demo sahnesi",
      subtitle: "Demo sahnesi",
      imagePath: ""
    }
  ]
};

// Remotion giriş noktasıdır; renderer bu composition'ı seçer ve gerçek proje verilerini render sırasında enjekte eder.
export function RemotionRoot() {
  return (
    <Composition
      id="AiVideo"
      component={AiVideo}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  );
}
