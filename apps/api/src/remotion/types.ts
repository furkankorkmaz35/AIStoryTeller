export type VideoScene = {
  text: string;
  imagePath: string;
  subtitle: string;
};

export type VideoProps = {
  title: string;
  story: string;
  scenes: VideoScene[];
  audioPath: string;
  apiBaseUrl: string;
};
