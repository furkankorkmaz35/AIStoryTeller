export type VideoScene = {
  text: string;
  imagePath: string;
  videoPath?: string;
  subtitle: string;
  materialType?: string;
};

export type VideoProps = {
  title: string;
  story: string;
  scenes: VideoScene[];
  audioPath: string;
  apiBaseUrl: string;
  subtitlesEnabled?: boolean;
  sceneDurationInFrames?: number;
  sceneDurationsInFrames?: number[];
  aspectRatio?: "9:16" | "16:9" | "1:1";
  language?: string;
};
